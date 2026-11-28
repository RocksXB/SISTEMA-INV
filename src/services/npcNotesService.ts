import { doc, getDocFromServer, runTransaction } from "firebase/firestore";
import { db } from "../lib/firebase";

export const maxNpcNoteLength = 20_000;
export type NpcNote = { text: string; revision: number };

function noteReference(npcId: string) {
  if (!/^[0-9]{19}$/.test(npcId)) throw Error("Personagem inválido.");
  return doc(db, "npcGmNotes", npcId);
}

export async function loadNpcNote(npcId: string): Promise<NpcNote> {
  const snapshot = await getDocFromServer(noteReference(npcId));
  if (!snapshot.exists()) return { text: "", revision: 0 };
  const { text, revision } = snapshot.data();
  if (typeof text !== "string" || !Number.isSafeInteger(revision) || revision < 1) {
    throw Error("A anotação deste personagem está inválida.");
  }
  return { text, revision };
}

export async function saveNpcNote(npcId: string, note: NpcNote): Promise<NpcNote> {
  if (note.text.length > maxNpcNoteLength) throw Error("A anotação excede o limite de caracteres.");
  const reference = noteReference(npcId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.exists() ? snapshot.data() : { text: "", revision: 0 };
    if (current.text === note.text) return { text: note.text, revision: current.revision as number };
    if (current.revision !== note.revision) {
      throw Error("A anotação mudou em outra janela. Copie seu texto antes de recarregar para conferir a versão atual.");
    }
    const saved = { text: note.text, revision: note.revision + 1 };
    transaction.set(reference, saved);
    return saved;
  });
}
