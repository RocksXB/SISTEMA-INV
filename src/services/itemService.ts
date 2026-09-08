import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { ItemDefinition } from "../types";
const ref = collection(db, "items");
export const subscribeItems = (
  cb: (v: ItemDefinition[]) => void,
  error: (e: Error) => void,
): Unsubscribe =>
  onSnapshot(
    ref,
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }) as ItemDefinition)),
    error,
  );
export async function getItems() {
  const s = await getDocs(ref);
  return s.docs.map((d) => ({ id: d.id, ...d.data() }) as ItemDefinition);
}
export async function saveItem(
  item: Omit<ItemDefinition, "id"> | ItemDefinition,
  id?: string,
) {
  const { id: _ignored, ...value } = item as ItemDefinition;
  void _ignored;
  const data = { ...value, updatedAt: serverTimestamp() };
  if (id) {
    await updateDoc(doc(db, "items", id), data);
    return id;
  }
  return (await addDoc(ref, { ...data, createdAt: serverTimestamp() })).id;
}
export async function deleteItem(id: string) {
  const itemRef = doc(db, "items", id);
  await runTransaction(db, async (transaction) => {
    const item = await transaction.get(itemRef);
    if (!item.exists()) throw new Error("A definição do item não existe.");
    transaction.update(itemRef, {
      deletionPending: true,
      updatedAt: serverTimestamp(),
    });
  });
  try {
    const references = await getDocs(
      query(
        collectionGroup(db, "inventory"),
        where("itemId", "==", id),
        limit(1),
      ),
    );
    if (!references.empty) {
      await updateDoc(itemRef, {
        deletionPending: false,
        updatedAt: serverTimestamp(),
      });
      throw new Error(
        "Este item ainda está presente em um inventário. Remova todas as unidades antes de excluir a definição global.",
      );
    }
    await deleteDoc(itemRef);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Este item ainda"))
      throw error;
    try {
      await updateDoc(itemRef, {
        deletionPending: false,
        updatedAt: serverTimestamp(),
      });
    } catch {
      /* The item may already have been deleted. */
    }
    throw error;
  }
}
