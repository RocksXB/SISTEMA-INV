import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type DocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import type {
  Character,
  SkillRequest,
  SkillRequestDraft,
} from "../types";
import { validateSkillRequest } from "../utils/skillRequest";

const requests = collection(db, "skillRequests");

const requestData = (snapshot: DocumentSnapshot) =>
  ({ id: snapshot.id, ...snapshot.data() }) as SkillRequest;

const sortRequests = (values: SkillRequest[]) =>
  values.sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0);
  });

export const subscribeMySkillRequests = (
  uid: string,
  cb: (values: SkillRequest[]) => void,
  error: (caught: Error) => void,
): Unsubscribe =>
  onSnapshot(
    query(requests, where("requestedBy", "==", uid)),
    (snapshot) =>
      cb(sortRequests(snapshot.docs.map((entry) => requestData(entry)))),
    error,
  );

export const subscribeAllSkillRequests = (
  cb: (values: SkillRequest[]) => void,
  error: (caught: Error) => void,
): Unsubscribe =>
  onSnapshot(
    requests,
    (snapshot) =>
      cb(sortRequests(snapshot.docs.map((entry) => requestData(entry)))),
    error,
  );

export async function createSkillRequest(
  characterId: string,
  draft: SkillRequestDraft,
) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sessão expirada.");
  const errors = validateSkillRequest(draft);
  if (errors.length) throw new Error(errors[0]);
  return (
    await addDoc(requests, {
      requestedBy: user.uid,
      characterId,
      status: "pending",
      ...draft,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  ).id;
}

export async function cancelSkillRequest(request: SkillRequest) {
  const uid = auth.currentUser?.uid;
  if (!uid || request.requestedBy !== uid || request.status !== "pending")
    throw new Error("Somente uma solicitação própria e pendente pode ser cancelada.");
  await deleteDoc(doc(requests, request.id));
}

export async function updatePendingSkillRequest(
  requestId: string,
  draft: SkillRequestDraft,
) {
  const errors = validateSkillRequest(draft);
  if (errors.length) throw new Error(errors[0]);
  await runTransaction(db, async (transaction) => {
    const ref = doc(requests, requestId);
    const current = await transaction.get(ref);
    if (!current.exists() || current.data().status !== "pending")
      throw new Error("Esta solicitação já foi revisada.");
    transaction.update(ref, { ...draft, updatedAt: serverTimestamp() });
  });
}

export async function rejectSkillRequest(
  requestId: string,
  reviewedBy: string,
  adminNote: string,
) {
  await runTransaction(db, async (transaction) => {
    const ref = doc(requests, requestId);
    const current = await transaction.get(ref);
    if (!current.exists() || current.data().status !== "pending")
      throw new Error("Esta solicitação já foi revisada.");
    transaction.update(ref, {
      status: "rejected",
      reviewedBy,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      adminNote: adminNote.trim(),
    });
  });
}

export const deleteSkillRequest = (requestId: string) =>
  deleteDoc(doc(requests, requestId));

export async function approveSkillRequest(
  requestId: string,
  reviewedBy: string,
  draft: SkillRequestDraft,
) {
  const errors = validateSkillRequest(draft);
  if (errors.length) throw new Error(errors[0]);
  const requestRef = doc(requests, requestId);
  const skillRef = doc(collection(db, "skills"));

  await runTransaction(db, async (transaction) => {
    const requestSnapshot = await transaction.get(requestRef);
    if (
      !requestSnapshot.exists() ||
      requestSnapshot.data().status !== "pending"
    )
      throw new Error("Esta solicitação já foi aprovada ou rejeitada.");

    const current = requestData(requestSnapshot);
    const characterRef = doc(db, "characters", current.characterId);
    const characterSnapshot = await transaction.get(characterRef);
    if (!characterSnapshot.exists())
      throw new Error("O personagem da solicitação não existe mais.");
    const character = {
      id: characterSnapshot.id,
      ...characterSnapshot.data(),
    } as Character;

    transaction.set(skillRef, {
      characterId: current.characterId,
      ownerId: character.ownerId,
      ...draft,
      createdBy: current.requestedBy,
      approvedBy: reviewedBy,
      approvedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.update(requestRef, {
      ...draft,
      status: "approved",
      reviewedBy,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      approvedSkillId: skillRef.id,
    });
  });

  return skillRef.id;
}
