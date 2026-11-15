import type { User } from "firebase/auth";
import { collection, getDocsFromServer } from "firebase/firestore";
import { db } from "../lib/firebase";

const endpoint = "/api/aparicoes";
export const maxNpcPortrait = 8 * 1024 * 1024;
export const npcAccents = ["cyan", "violet", "amber", "green", "rose"] as const;

export type NpcAccent = (typeof npcAccents)[number];
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
export type NpcCatalog = {
  topics: Array<{ id: string; title: string }>;
  records: Npc[];
};
export type NpcEdit = {
  name: string;
  accent: NpcAccent;
  fields: NpcField[];
  imageAction: "manter" | "original" | "trocar";
};

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

export async function loadNpcs(user: User, signal?: AbortSignal): Promise<NpcCatalog & { editsAvailable: boolean }> {
  const response = await request(user, "catalogo", { signal });
  const catalog: NpcCatalog = await response.json();
  try {
    const documents = await getDocsFromServer(collection(db, "aparicaoEdits"));
    const edits = new Map<string, Pick<Npc, "name" | "fields" | "accent" | "image" | "revision">>();
    for (const document of documents.docs) {
      const { revision, payload } = document.data();
      try {
        const data = JSON.parse(payload);
        if (typeof data.name !== "string" || !Array.isArray(data.fields) ||
          !data.fields.every((field: unknown) => Array.isArray(field) && field.length === 2 && field.every((part) => typeof part === "string"))) continue;
        edits.set(document.id, {
          name: data.name, fields: data.fields, accent: data.accent,
          image: typeof data.image === "string" ? data.image : undefined, revision,
        });
      } catch {
        // A malformed manually edited document does not hide the original card.
      }
    }
    return {
      topics: catalog.topics,
      records: catalog.records.map((original) => {
        const edit = edits.get(original.id);
        return edit ? { ...original, ...edit, originalImage: original.image } : original;
      }),
      editsAvailable: true,
    };
  } catch {
    return { ...catalog, editsAvailable: false };
  }
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
  const body = new FormData();
  body.set("ficha", JSON.stringify({ ...edit, revision: original.revision ?? 0 }));
  if (photo) body.set("retrato", photo, "retrato");
  const response = await request(user, `fichas/${original.id}`, { method: "PUT", body });
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
