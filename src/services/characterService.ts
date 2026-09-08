import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Character } from "../types";
const chars = collection(db, "characters");
export async function getCharacters(uid: string, isAdmin: boolean) {
  const q = isAdmin ? chars : query(chars, where("ownerId", "==", uid));
  const s = await getDocs(q);
  return s.docs.map((d) => ({ id: d.id, ...d.data() }) as Character);
}
export async function getCharacter(id: string) {
  const s = await getDoc(doc(db, "characters", id));
  return s.exists() ? ({ id: s.id, ...s.data() } as Character) : null;
}
export const subscribeCharacter = (
  id: string,
  cb: (v: Character | null) => void,
  error: (e: Error) => void,
): Unsubscribe =>
  onSnapshot(
    doc(db, "characters", id),
    (s) => cb(s.exists() ? ({ id: s.id, ...s.data() } as Character) : null),
    error,
  );
export async function saveCharacter(
  value: Omit<Character, "id"> | Character,
  id?: string,
) {
  const { id: _ignored, ...fields } = value as Character;
  void _ignored;
  const data = { ...fields, updatedAt: serverTimestamp() };
  if (id) {
    await updateDoc(doc(db, "characters", id), data);
    return id;
  }
  return (await addDoc(chars, { ...data, createdAt: serverTimestamp() })).id;
}
export async function deleteCharacter(id: string) {
  const inventory = collection(db, "characters", id, "inventory");
  // Keep below Firestore's 500-operation batch limit and repeat until empty.
  while (true) {
    const page = await getDocs(
      query(inventory, orderBy(documentId()), limit(450)),
    );
    if (page.empty) break;
    const batch = writeBatch(db);
    page.docs.forEach((entry) => batch.delete(entry.ref));
    await batch.commit();
  }
  await deleteDoc(doc(db, "characters", id));
}
