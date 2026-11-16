import { isNpcAccent } from "../../../src/config/npcAccents.ts";
import { parseCampaignDate } from "../../../src/features/calendar/campaignDates.ts";
import { removeTrackedPortrait, reservePortraitBytes } from "../../../src/server/aparicoesQuota.js";

const projectId = "telaprincipal-23a86";
const firestore = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const bucketKey = "fichas.json";
const signingKeyName = "_sessao_retratos";
const mediaCookie = "__Secure-aparicoes-retratos";
const sessionSeconds = 30 * 60;
const maxImage = 8 * 1024 * 1024;
const imageKey = /^\d{19}(?:-[a-f\d-]{36})?\.(?:webp|jpg|png|gif)$/;
const customTopicId = /^t-[0-9a-f]{64}$/;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
let mediaSigningKey;

const toBase64Url = (bytes) => btoa(String.fromCharCode(...bytes))
  .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const fromBase64Url = (value) => Uint8Array.from(
  atob(value.replaceAll("-", "+").replaceAll("_", "/")), (char) => char.charCodeAt(0),
);

function json(body, status = 200, headers) {
  return Response.json(body, {
    status,
    headers: {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers},
  });
}

function mediaSession(value, maxAge) {
  return `${mediaCookie}=${value}; Path=/api/aparicoes/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Strict`;
}

// Firestore authenticates this ID token and applies the existing users/{uid} read rule.
async function getRole(request) {
  const token = request.headers.get("Authorization")?.match(/^Bearer ([\w.-]{1,8192})$/)?.[1];
  if (!token) return null;
  let uid;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    uid = JSON.parse(decoder.decode(fromBase64Url(parts[1]))).sub;
  } catch {
    return null;
  }
  if (typeof uid !== "string" || !uid || uid.length > 128 || uid.includes("/") || uid === "." || uid === "..") return null;
  const url = `${firestore}/users/${encodeURIComponent(uid)}?mask.fieldPaths=role`;
  const response = await fetch(url, {
    headers: {Authorization: `Bearer ${token}`},
    redirect: "manual",
    signal: AbortSignal.timeout(8000),
  });
  if (response.status >= 500 || response.status === 429) throw Error("Firestore indisponível");
  if (!response.ok) return null;
  const role = (await response.json()).fields?.role?.stringValue;
  return role === "admin" || role === "player" ? role : null;
}

async function signingKey(bucket, create = false) {
  if (mediaSigningKey) return mediaSigningKey;
  let object = await bucket.get(signingKeyName);
  if (!object && create) {
    const generated = crypto.getRandomValues(new Uint8Array(32));
    const saved = await bucket.put(signingKeyName, generated, {
      onlyIf: new Headers({"If-None-Match": "*"}),
    });
    if (saved) {
      mediaSigningKey = await crypto.subtle.importKey("raw", generated, {name:"HMAC",hash:"SHA-256"}, false, ["sign","verify"]);
      return mediaSigningKey;
    }
    object = await bucket.get(signingKeyName);
  }
  if (!object) return null;
  const raw = await object.arrayBuffer();
  if (raw.byteLength !== 32) throw Error("Chave de mídia inválida");
  mediaSigningKey = await crypto.subtle.importKey("raw", raw, {name:"HMAC",hash:"SHA-256"}, false, ["sign","verify"]);
  return mediaSigningKey;
}

async function newMediaSession(bucket) {
  const key = await signingKey(bucket, true);
  const expires = String(Math.floor(Date.now() / 1000) + sessionSeconds);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(expires));
  return mediaSession(`${expires}.${toBase64Url(new Uint8Array(signature))}`, sessionSeconds);
}

async function canReadMedia(request, bucket) {
  const value = request.headers.get("Cookie")?.split(/;\s*/).find((entry) => entry.startsWith(`${mediaCookie}=`));
  const match = value?.slice(mediaCookie.length + 1).match(/^(\d{10})\.([\w-]{43})$/);
  if (!match || Number(match[1]) <= Date.now() / 1000) return false;
  const key = await signingKey(bucket);
  return !!key && await crypto.subtle.verify("HMAC", key, fromBase64Url(match[2]), encoder.encode(match[1]));
}

async function servePortrait(request, bucket, key) {
  if (!imageKey.test(key)) return json({error:"Retrato não encontrado."}, 404);
  if (!await canReadMedia(request, bucket)) return json({error:"Sessão expirada."}, 401);
  const etag = request.headers.get("If-None-Match");
  const object = await bucket.get(key, etag ? {onlyIf:new Headers({"If-None-Match":etag})} : undefined);
  if (!object) return json({error:"Retrato não encontrado."}, 404);
  const types = {webp:"image/webp",jpg:"image/jpeg",png:"image/png",gif:"image/gif"};
  const headers = {
    "Content-Type": types[key.split(".").at(-1)],
    "Cache-Control": "private, max-age=900",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
    ETag: object.httpEtag,
  };
  return "body" in object ? new Response(object.body, {headers}) : new Response(null, {status:304,headers});
}

async function readEdit(request) {
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.startsWith("multipart/form-data;") || !request.body) return null;
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxImage + 96 * 1024) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const form = await new Response(new Blob(chunks), {headers:{"Content-Type":contentType}}).formData();
    const raw = form.get("ficha");
    if (typeof raw !== "string" || raw.length > 36000) return null;
    const edit = JSON.parse(raw);
    const file = form.get("retrato");
    if (!edit || typeof edit.name !== "string" || !edit.name.trim() || edit.name.length > 150 ||
      !isNpcAccent(edit.accent) || !Number.isSafeInteger(edit.revision) || edit.revision < 0 ||
      (edit.ageReferenceDate !== undefined && !parseCampaignDate(edit.ageReferenceDate)) ||
      !["manter","original","trocar"].includes(edit.imageAction) ||
      !Array.isArray(edit.fields) || edit.fields.length > 32 ||
      edit.fields.some((pair) => !Array.isArray(pair) || pair.length !== 2 ||
        typeof pair[0] !== "string" || !pair[0].trim() || pair[0].length > 80 ||
        typeof pair[1] !== "string" || pair[1].length > 1000)) return null;
    if (edit.imageAction === "trocar" && (!(file instanceof Blob) || !file.size || file.size > maxImage)) return null;
    return {edit, file};
  } catch {
    return null;
  }
}

function sniffImage(bytes) {
  const starts = (...prefix) => prefix.every((value,index) => bytes[index] === value);
  const text = (first,last) => decoder.decode(bytes.subarray(first,last));
  if (bytes.length >= 16 && text(0,4) === "RIFF" && text(8,12) === "WEBP") return ["webp","image/webp"];
  if (starts(137,80,78,71,13,10,26,10)) return ["png","image/png"];
  if (starts(255,216,255)) return ["jpg","image/jpeg"];
  if (["GIF87a","GIF89a"].includes(text(0,6))) return ["gif","image/gif"];
  return null;
}

async function updateCard(request, bucket, id) {
  const input = await readEdit(request);
  if (!input) return json({error:"Revise os campos e o limite de 8 MB por retrato."},400);
  const {edit,file} = input;
  const catalogFile = await bucket.get(bucketKey);
  if (!catalogFile) return json({error:"O catálogo ainda não foi importado."},503);
  const catalog = await catalogFile.json();
  const baseline = catalog.records.find((card) => card.id === id);
  const creating = request.method === "POST";

  const url = `${firestore}/aparicaoEdits/${id}`;
  const headers = {Authorization:request.headers.get("Authorization"),"Content-Type":"application/json"};
  const result = await fetch(url, {headers,redirect:"manual",signal:AbortSignal.timeout(8000)});
  if (!result.ok && result.status !== 404) return rulesError(result.status);
  const stored = result.ok ? await result.json() : null;
  const revision = Number(stored?.fields?.revision?.integerValue ?? 0);
  const conflict = () => json({error:"A ficha mudou enquanto você editava. Recarregue o catálogo e tente de novo."},409);
  if (revision !== edit.revision || (creating && (stored || baseline))) return conflict();
  const previous = stored ? JSON.parse(stored.fields.payload.stringValue) : baseline;
  if (!creating && !previous) return json({error:"Ficha não encontrada."},404);
  const topicId = creating ? edit.topicId : baseline?.topicId ?? previous.topicId;
  if (creating && !catalog.topics.some((topic) => topic.id === topicId)) {
    if (typeof topicId !== "string" || !customTopicId.test(topicId)) {
      return json({error:"Selecione um tópico existente."},400);
    }
    const topic = await fetch(`${firestore}/aparicaoTopics/${topicId}`, {
      headers,redirect:"manual",signal:AbortSignal.timeout(8000),
    });
    if (topic.status === 404) return json({error:"Selecione um tópico existente."},400);
    if (!topic.ok) return rulesError(topic.status);
  }

  let uploaded;
  if (edit.imageAction === "trocar") {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffImage(bytes);
    if (!type) return json({error:"Use um retrato JPG, PNG, WebP ou GIF válido."},415);
    let hasSpace;
    try {
      hasSpace = await reservePortraitBytes(bucket, bytes.byteLength);
    } catch {
      return json({error:"Não foi possível verificar a cota de retratos. Tente de novo."},503);
    }
    if (!hasSpace) return json({error:"Limite de 3 GB atingido. Tente enviar uma versão menor do retrato."},413);
    uploaded = `${id}-${crypto.randomUUID()}.${type[0]}`;
    await bucket.put(uploaded, bytes, {httpMetadata:{contentType:type[1]}});
  }
  const next = {
    name:edit.name.trim(),
    topicId,
    ageReferenceDate:edit.ageReferenceDate ?? previous?.ageReferenceDate,
    fields:edit.fields.map(([label,value]) => [label.trim(),value.trim()]),
    accent:edit.accent,
    image:uploaded ?? (edit.imageAction === "original" ? baseline?.image : previous?.image),
  };
  const precondition = stored ? `currentDocument.updateTime=${encodeURIComponent(stored.updateTime)}` : "currentDocument.exists=false";
  const saved = await fetch(`${url}?${precondition}`, {
    method:"PATCH",headers,redirect:"manual",signal:AbortSignal.timeout(8000),
    body:JSON.stringify({fields:{
      revision:{integerValue:String(revision+1)},
      payload:{stringValue:JSON.stringify(next)},
    }}),
  });
  if (!saved.ok) {
    if (uploaded && saved.status < 500) await removeTrackedPortrait(bucket, uploaded).catch(() => {});
    const failure = await saved.json().catch(() => null);
    if (["ALREADY_EXISTS","ABORTED","FAILED_PRECONDITION"].includes(failure?.error?.status)) return conflict();
    return rulesError(saved.status);
  }
  if (previous?.image && previous.image !== baseline?.image && previous.image !== next.image &&
      previous.image.startsWith(`${id}-`) && imageKey.test(previous.image)) {
    await removeTrackedPortrait(bucket, previous.image).catch(() => {});
  }
  return json({...baseline,...next,id,originalImage:baseline?.image,revision:revision+1},creating ? 201 : 200);
}

function rulesError(status) {
  return status === 403
    ? json({error:"A edição depende da regra Aparições publicada no Firestore."},403)
    : json({error:"Não foi possível salvar a ficha no Firestore."},503);
}

export async function onRequest({request,env,params}) {
  const [section,arg,extra] = params.path || [];
  if (extra) return json({error:"Rota não encontrada."},404);
  if (request.method === "DELETE" && section === "sessao" && !arg) {
    return new Response(null, {status:204,headers:{"Set-Cookie":mediaSession("",0)}});
  }
  const bucket = env.APARICOES_MEDIA;
  if (!bucket) return json({error:"O armazenamento de Aparições ainda não está conectado."},503);
  try {
    if (request.method === "GET" && section === "retratos" && arg) return await servePortrait(request,bucket,arg);
    if (!((request.method === "GET" && ["catalogo","sessao"].includes(section) && !arg) ||
      (["PUT","POST"].includes(request.method) && section === "fichas" && /^\d{19}$/.test(arg || "")))) {
      return json({error:"Rota não encontrada."},404);
    }
    const role = await getRole(request);
    if (!role) return json({error:"Entre com um perfil do SISTEMA-INV."},401);
    if (request.method === "PUT" || request.method === "POST") {
      if (role !== "admin") return json({error:"A edição é exclusiva do GM."},403);
      return await updateCard(request,bucket,arg);
    }
    if (section === "sessao") {
      return new Response(null, {status:204,headers:{"Set-Cookie":await newMediaSession(bucket),"Cache-Control":"no-store"}});
    }
    const object = await bucket.get(bucketKey);
    if (!object) return json({error:"O catálogo ainda não foi importado."},503);
    return new Response(object.body, {headers:{
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"private, no-store",
      "X-Content-Type-Options":"nosniff",
      "Set-Cookie":await newMediaSession(bucket),
    }});
  } catch {
    return json({error:"Não foi possível acessar o catálogo agora."},503);
  }
}
