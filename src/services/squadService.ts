import { collection, doc, getDocsFromServer, runTransaction } from "firebase/firestore";
import { db } from "../lib/firebase";

export const maxSquadName = 80;
export const maxSquadRole = 60;
const maxSquadMembers = 1_000;
const npcId = /^[0-9]{19}$/;
const squads = () => collection(db, "aparicaoSquads");

export type Squad = {
  id: string; name: string; memberIds: string[]; revision: number;
  createdAt?: number; memberRoles?: Record<string, string>;
};
export type SquadDetails = Pick<Squad, "name" | "memberIds" | "memberRoles">;

export async function loadSquads(): Promise<Squad[]> {
  const snapshot = await getDocsFromServer(squads());
  return snapshot.docs.map((entry) => {
    const { name, memberIds, revision, createdAt, memberRoles: storedRoles } = entry.data();
    if (typeof name !== "string" || !Array.isArray(memberIds) ||
        !memberIds.every((id) => typeof id === "string" && npcId.test(id)) ||
        !Number.isSafeInteger(revision)) {
      throw new Error("Há um esquadrão com dados inválidos.");
    }
    const roles = storedRoles && typeof storedRoles === "object" && !Array.isArray(storedRoles) ? storedRoles : {};
    const memberRoles = Object.fromEntries(Object.entries(roles).filter(([id, role]) =>
      memberIds.includes(id) && typeof role === "string" && role.trim().length > 0 && role.length <= maxSquadRole)) as Record<string, string>;
    return { id: entry.id, name, memberIds, revision, memberRoles,
      createdAt: Number.isSafeInteger(createdAt) && createdAt > 0 ? createdAt : undefined };
  });
}

export async function saveSquad(details: SquadDetails, previous?: Squad): Promise<Squad> {
  const name = details.name.trim().replace(/\s+/g, " ");
  if (!name || name.length > maxSquadName) {
    throw new Error(`Informe um nome de até ${maxSquadName} caracteres.`);
  }
  const memberIds = [...new Set(details.memberIds)];
  if (memberIds.length > maxSquadMembers || memberIds.some((id) => !npcId.test(id))) {
    throw new Error("A lista de integrantes está inválida.");
  }
  const memberRoles: Record<string, string> = {};
  for (const id of memberIds) {
    const role = details.memberRoles?.[id];
    if (role === undefined) continue;
    if (typeof role !== "string" || role.trim().length > maxSquadRole) {
      throw new Error(`Use até ${maxSquadRole} caracteres na função de cada integrante.`);
    }
    if (role.trim()) memberRoles[id] = role.trim();
  }
  const reference = previous ? doc(squads(), previous.id) : doc(squads());
  const revision = previous ? previous.revision + 1 : 1;
  const createdAt = previous ? previous.createdAt : Date.now();
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (previous ? snapshot.data()?.revision !== previous.revision : snapshot.exists()) {
      throw new Error("O esquadrão mudou. Atualize a página e tente novamente.");
    }
    transaction.set(reference, { name, memberIds, memberRoles, revision, ...(createdAt === undefined ? {} : { createdAt }) });
  });
  return { id: reference.id, name, memberIds, memberRoles, revision, createdAt };
}

export async function deleteSquad(squad: Squad) {
  const reference = doc(squads(), squad.id);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) return;
    if (snapshot.data().revision !== squad.revision) {
      throw new Error("O esquadrão mudou. Atualize a página e tente novamente.");
    }
    transaction.delete(reference);
  });
}
