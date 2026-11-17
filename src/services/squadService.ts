import { collection, doc, getDocsFromServer, runTransaction } from "firebase/firestore";
import { db } from "../lib/firebase";

export const maxSquadName = 80;
const maxSquadMembers = 1_000;
const npcId = /^[0-9]{19}$/;
const squads = () => collection(db, "aparicaoSquads");

export type Squad = { id: string; name: string; memberIds: string[]; revision: number };
export type SquadDetails = Pick<Squad, "name" | "memberIds">;

export async function loadSquads(): Promise<Squad[]> {
  const snapshot = await getDocsFromServer(squads());
  return snapshot.docs.map((entry) => {
    const { name, memberIds, revision } = entry.data();
    if (typeof name !== "string" || !Array.isArray(memberIds) ||
        !memberIds.every((id) => typeof id === "string" && npcId.test(id)) ||
        !Number.isSafeInteger(revision)) {
      throw new Error("Há um esquadrão com dados inválidos.");
    }
    return { id: entry.id, name, memberIds, revision };
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
  const reference = previous ? doc(squads(), previous.id) : doc(squads());
  const revision = previous ? previous.revision + 1 : 1;
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (previous ? snapshot.data()?.revision !== previous.revision : snapshot.exists()) {
      throw new Error("O esquadrão mudou. Atualize a página e tente novamente.");
    }
    transaction.set(reference, { name, memberIds, revision });
  });
  return { id: reference.id, name, memberIds, revision };
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
