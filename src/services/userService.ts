import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { UserProfile } from "../types";
export async function getUserProfile(uid: string) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists()
    ? ({ id: snap.id, ...snap.data() } as UserProfile)
    : null;
}
