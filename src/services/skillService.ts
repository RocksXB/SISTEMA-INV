import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import type { SkillDefinition, SkillRequestDraft } from "../types";

const skills = collection(db, "skills");

export const subscribeSkillsForCharacter = (
  characterId: string,
  uid: string,
  isAdmin: boolean,
  cb: (values: SkillDefinition[]) => void,
  error: (caught: Error) => void,
): Unsubscribe => {
  const source = isAdmin ? skills : query(skills, where("ownerId", "==", uid));
  return onSnapshot(
    source,
    (snapshot) =>
      cb(
        snapshot.docs
          .map(
            (entry) =>
              ({ id: entry.id, ...entry.data() }) as SkillDefinition,
          )
          .filter((entry) => entry.characterId === characterId)
          .sort((a, b) => a.name.localeCompare(b.name)),
      ),
    error,
  );
};

export const subscribeAllSkills = (
  cb: (values: SkillDefinition[]) => void,
  error: (caught: Error) => void,
): Unsubscribe =>
  onSnapshot(
    skills,
    (snapshot) =>
      cb(
        snapshot.docs
          .map(
            (entry) =>
              ({ id: entry.id, ...entry.data() }) as SkillDefinition,
          )
          .sort((a, b) => a.name.localeCompare(b.name)),
      ),
    error,
  );

export async function saveSkill(
  value: SkillRequestDraft & { characterId: string; ownerId: string },
  id?: string,
) {
  const actor = auth.currentUser?.uid;
  if (!actor) throw new Error("Sessão expirada.");
  const data = { ...value, updatedAt: serverTimestamp() };
  if (id) {
    await updateDoc(doc(db, "skills", id), data);
    return id;
  }
  return (
    await addDoc(skills, {
      ...data,
      createdBy: actor,
      approvedBy: actor,
      approvedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    })
  ).id;
}

export const deleteSkill = (id: string) => deleteDoc(doc(skills, id));
