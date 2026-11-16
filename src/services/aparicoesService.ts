import type { User } from "firebase/auth";
import { collection, doc, getDocsFromServer, runTransaction } from "firebase/firestore";
import { isNpcAccent, type NpcAccent } from "../config/npcAccents";
import { db } from "../lib/firebase";

const endpoint = "/api/aparicoes";
export const maxNpcPortrait = 8 * 1024 * 1024;
export type NpcField = [string, string];
export type Npc = {
  id: string;
  topicId: string;
  name: string;
  fields: NpcField[];
  image?: string;
  originalImage?: string;
  accent?: NpcAccent;
  revision?: number;
};
export type NpcTopic = { id: string; title: string };
export type NpcCatalog = {
  topics: NpcTopic[];
  records: Npc[];
};
export type LoadedNpcs = NpcCatalog & { editsAvailable: boolean; topicsAvailable: boolean };
export type NpcEdit = {
  name: string;
  accent: NpcAccent;
  fields: NpcField[];
  imageAction: "manter" | "original" | "trocar";
};

export const normalizeNpcText = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function newNpcId() {
  const [random] = crypto.getRandomValues(new BigUint64Array(1));
  return (random % 10_000_000_000_000_000_000n).toString().padStart(19, "0");
}

export async function createNpcTopic(value: string, topics: NpcTopic[]): Promise<NpcTopic> {
  const title = value.trim().replace(/\s+/g, " ");
  if (!title || title.length > 60) throw new Error("Informe um nome de até 60 caracteres.");
  const normalized = normalizeNpcText(title);
  const duplicate = "Já existe um tópico com esse nome.";
  if (topics.some((topic) => normalizeNpcText(topic.title) === normalized)) throw new Error(duplicate);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  const id = "t-" + Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const reference = doc(db, "aparicaoTopics", id);
  await runTransaction(db, async (transaction) => {
    if ((await transaction.get(reference)).exists()) throw new Error(duplicate);
    transaction.set(reference, { title });
  });
  return { id, title };
}

async function request(user: User, path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  const response = await fetch(`${endpoint}/${path}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Não foi possível acessar Aparições.");
  }
  return response;
}

export async function loadNpcs(user: User, signal?: AbortSignal): Promise<LoadedNpcs> {
  const response = await request(user, "catalogo", { signal });
  const catalog: NpcCatalog = await response.json();
  const [saved, customTopics] = await Promise.allSettled([
    getDocsFromServer(collection(db, "aparicaoEdits")),
    getDocsFromServer(collection(db, "aparicaoTopics")),
  ]);
  const topics = [...catalog.topics];
  if (customTopics.status === "fulfilled") {
    const entries = customTopics.value.docs.flatMap((document) => {
      const { title } = document.data();
      return typeof title === "string" && title.trim() ? [{ id: document.id, title }] : [];
    });
    topics.push(...entries.sort((a, b) => a.title.localeCompare(b.title, "pt-BR")));
  }
  const edits = new Map<string, Omit<Npc, "topicId"> & { topicId?: string }>();
  if (saved.status === "fulfilled") {
    for (const document of saved.value.docs) {
      const { revision, payload } = document.data();
      try {
        const data = JSON.parse(payload);
        if (typeof data.name !== "string" || !Array.isArray(data.fields) ||
          !data.fields.every((field: unknown) => Array.isArray(field) && field.length === 2 && field.every((part) => typeof part === "string"))) continue;
        edits.set(document.id, {
          id: document.id,
          topicId: typeof data.topicId === "string" ? data.topicId : undefined,
          name: data.name, fields: data.fields, accent: isNpcAccent(data.accent) ? data.accent : undefined,
          image: typeof data.image === "string" ? data.image : undefined, revision,
        });
      } catch {
        // A malformed manually edited document does not hide the original card.
      }
    }
  }
  const records = catalog.records.map((original) => {
    const edit = edits.get(original.id);
    edits.delete(original.id);
    return edit ? { ...original, ...edit, topicId: original.topicId, originalImage: original.image } : original;
  });
  const created = Array.from(edits.values()).flatMap((edit) => edit.topicId ? [{ ...edit, topicId: edit.topicId }] : []);
  return { topics, records: [...created, ...records], editsAvailable: saved.status === "fulfilled", topicsAvailable: customTopics.status === "fulfilled" };
}

export async function refreshPortraitSession(user: User) {
  await request(user, "sessao");
}

export async function clearPortraitSession() {
  await fetch(`${endpoint}/sessao`, { method: "DELETE", signal: AbortSignal.timeout(2000) });
}

export function portraitSrc(key: string) {
  return `${endpoint}/retratos/${encodeURIComponent(key)}`;
}

export async function saveNpc(user: User, original: Npc, edit: NpcEdit, photo?: Blob): Promise<Npc> {
  return writeNpc(user, original.id, "PUT", { ...edit, revision: original.revision ?? 0 }, photo);
}

export async function addNpc(user: User, id: string, topicId: string, edit: NpcEdit, photo?: Blob): Promise<Npc> {
  return writeNpc(user, id, "POST", { ...edit, topicId, revision: 0 }, photo);
}

async function writeNpc(user: User, id: string, method: "PUT" | "POST",
  edit: NpcEdit & { revision: number; topicId?: string }, photo?: Blob): Promise<Npc> {
  const body = new FormData();
  body.set("ficha", JSON.stringify(edit));
  if (photo) body.set("retrato", photo, "retrato");
  const response = await request(user, `fichas/${id}`, { method, body });
  return response.json();
}

export async function fetchNpcImage(link: string) {
  const url = URL.parse(link.trim());
  if (!url || url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Informe um link HTTPS direto para a imagem.");
  }
  let response;
  try {
    response = await fetch(url, {
      credentials: "omit",
      referrerPolicy: "no-referrer",
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new Error("O endereço não permitiu importar a imagem. Baixe o arquivo e envie pelo campo de retrato.");
  }
  const type = response.headers.get("Content-Type")?.split(";")[0];
  if (!response.ok || !response.body || !type || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(type)) {
    throw new Error("Use um link direto para um JPG, PNG, WebP ou GIF.");
  }
  const reader = response.body.getReader();
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxNpcPortrait) {
      await reader.cancel();
      throw new Error("O retrato deve ter até 8 MB.");
    }
    parts.push(new Uint8Array(value));
  }
  return new Blob(parts, { type });
}
