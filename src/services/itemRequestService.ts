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
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import type {
  InventoryItem,
  ItemDefinition,
  ItemRequest,
  ItemRequestDraft,
} from "../types";
import {
  buildInventoryGrants,
  buildItemDefinitionFromRequest,
  calculateApprovedStackQuantity,
  validateItemRequest,
} from "../utils/itemRequest";

const requests = collection(db, "itemRequests");
const requestData = (snapshot: { id: string; data: () => unknown }) =>
  ({ id: snapshot.id, ...(snapshot.data() as object) }) as ItemRequest;

export function subscribeMyItemRequests(
  uid: string,
  callback: (values: ItemRequest[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(requests, where("requestedBy", "==", uid)),
    (snapshot) =>
      callback(
        snapshot.docs
          .map(requestData)
          .sort(
            (a, b) =>
              (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0),
          ),
      ),
    onError,
  );
}

export function subscribeAllItemRequests(
  callback: (values: ItemRequest[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    requests,
    (snapshot) =>
      callback(
        snapshot.docs.map(requestData).sort((a, b) => {
          if (a.status === "pending" && b.status !== "pending") return -1;
          if (a.status !== "pending" && b.status === "pending") return 1;
          return (
            (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)
          );
        }),
      ),
    onError,
  );
}

export async function createItemRequest(
  characterId: string,
  draft: ItemRequestDraft,
) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sessão expirada. Entre novamente.");
  const errors = validateItemRequest(draft);
  if (errors.length) throw new Error(errors[0]);
  return addDoc(requests, {
    ...draft,
    requestedBy: user.uid,
    characterId,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function cancelItemRequest(request: ItemRequest) {
  const user = auth.currentUser;
  if (!user || request.requestedBy !== user.uid || request.status !== "pending")
    throw new Error(
      "Somente solicitações próprias e pendentes podem ser canceladas.",
    );
  await deleteDoc(doc(requests, request.id));
}

export async function updatePendingRequest(
  requestId: string,
  draft: ItemRequestDraft,
) {
  const errors = validateItemRequest(draft);
  if (errors.length) throw new Error(errors[0]);
  await runTransaction(db, async (transaction) => {
    const ref = doc(requests, requestId);
    const current = await transaction.get(ref);
    if (!current.exists() || current.data().status !== "pending")
      throw new Error("Esta solicitação já foi revisada.");
    transaction.update(ref, { ...draft, updatedAt: serverTimestamp() });
  });
}

export async function rejectItemRequest(
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

export const deleteItemRequest = (requestId: string) =>
  deleteDoc(doc(requests, requestId));

export async function approveItemRequest(
  requestId: string,
  reviewedBy: string,
  option:
    | { existingItemId: string; reviewed: ItemRequestDraft }
    | { create: ItemRequestDraft },
) {
  const reviewedDraft =
    "existingItemId" in option ? option.reviewed : option.create;
  const requestRef = doc(requests, requestId);
  const itemRef =
    "existingItemId" in option
      ? doc(db, "items", option.existingItemId)
      : doc(collection(db, "items"));
  // Prepared references are stable across automatic transaction retries.
  const nonStackRefs = Array.from({ length: 450 }, () =>
    doc(collection(db, "characters", "placeholder", "inventory")),
  );

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

    let definition: ItemDefinition;
    if ("existingItemId" in option) {
      const itemSnapshot = await transaction.get(itemRef);
      if (
        !itemSnapshot.exists() ||
        itemSnapshot.data().deletionPending === true
      )
        throw new Error("O item selecionado não está disponível.");
      definition = {
        id: itemSnapshot.id,
        ...itemSnapshot.data(),
      } as ItemDefinition;
    } else {
      const errors = validateItemRequest(option.create);
      if (errors.length) throw new Error(errors[0]);
      definition = buildItemDefinitionFromRequest(itemRef.id, option.create);
    }
    const errors = validateItemRequest(reviewedDraft, definition);
    if (errors.length) throw new Error(errors[0]);

    const inventoryCollection = collection(
      db,
      "characters",
      current.characterId,
      "inventory",
    );
    let stackRef: ReturnType<typeof doc> | null = null;
    let stackSnapshot: Awaited<ReturnType<typeof transaction.get>> | null =
      null;
    if (definition.stackable) {
      stackRef = doc(inventoryCollection, definition.id);
      stackSnapshot = await transaction.get(stackRef);
    } else if (reviewedDraft.quantity > 450) {
      throw new Error("Uma aprovação não pode criar mais de 450 entradas.");
    }

    if (!("existingItemId" in option)) {
      const { id: _id, ...itemFields } = definition;
      void _id;
      transaction.set(itemRef, {
        ...itemFields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (definition.stackable && stackRef && stackSnapshot) {
      if (stackSnapshot.exists()) {
        const existing = stackSnapshot.data() as InventoryItem;
        const next = calculateApprovedStackQuantity(
          existing,
          reviewedDraft.quantity,
          definition.maxStack,
        );
        transaction.update(stackRef, {
          quantity: next,
          updatedAt: serverTimestamp(),
        });
      } else {
        transaction.set(stackRef, {
          itemId: definition.id,
          quantity: reviewedDraft.quantity,
          equipped: false,
          equipmentSlot: null,
          acquiredAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      const grants = buildInventoryGrants(
        definition.id,
        reviewedDraft.quantity,
        false,
      );
      for (let index = 0; index < grants.length; index += 1) {
        const target = doc(inventoryCollection, nonStackRefs[index].id);
        transaction.set(target, {
          ...grants[index],
          equipped: false,
          equipmentSlot: null,
          acquiredAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }
    transaction.update(requestRef, {
      ...reviewedDraft,
      status: "approved",
      reviewedBy,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      approvedItemId: definition.id,
    });
  });
  return itemRef.id;
}
