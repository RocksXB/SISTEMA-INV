import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { EquipmentSlot, InventoryItem, ItemDefinition } from "../types";
import { canEquipItem } from "../utils/inventory";
const inv = (cid: string) => collection(db, "characters", cid, "inventory");
export const subscribeInventory = (
  cid: string,
  cb: (v: InventoryItem[]) => void,
  error: (e: Error) => void,
): Unsubscribe =>
  onSnapshot(
    inv(cid),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }) as InventoryItem)),
    error,
  );
export async function equipItem(
  cid: string,
  entry: InventoryItem,
  item: ItemDefinition,
  slot: EquipmentSlot,
  all: InventoryItem[],
) {
  const check = canEquipItem(item, slot, all, entry.id);
  if (!check.allowed) throw new Error(check.reason);
  await updateDoc(doc(inv(cid), entry.id), {
    equipped: true,
    equipmentSlot: slot,
    updatedAt: serverTimestamp(),
  });
}
export const unequipItem = (cid: string, id: string) =>
  updateDoc(doc(inv(cid), id), {
    equipped: false,
    equipmentSlot: null,
    updatedAt: serverTimestamp(),
  });
export async function deliverItem(
  cid: string,
  item: ItemDefinition,
  amount: number,
) {
  const qty = Math.floor(amount);
  if (qty < 1) throw new Error("Quantidade inválida.");
  const itemRef = doc(db, "items", item.id);
  if (!item.stackable) {
    if (qty !== 1)
      throw new Error(
        "Itens não empilháveis devem ser entregues individualmente.",
      );
    const target = doc(inv(cid));
    await runTransaction(db, async (tx) => {
      const liveItem = await tx.get(itemRef);
      if (!liveItem.exists() || liveItem.data().deletionPending === true)
        throw new Error("Este item está indisponível para entrega.");
      tx.set(target, {
        itemId: item.id,
        quantity: 1,
        equipped: false,
        equipmentSlot: null,
        acquiredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    return;
  }
  if (qty > item.maxStack)
    throw new Error(`Máximo permitido: ${item.maxStack}.`);
  // A stackable item always has one deterministic inventory document per character.
  const target = doc(inv(cid), item.id);
  await runTransaction(db, async (tx) => {
    const liveItem = await tx.get(itemRef);
    if (!liveItem.exists() || liveItem.data().deletionPending === true)
      throw new Error("Este item está indisponível para entrega.");
    const snapshot = await tx.get(target);
    if (!snapshot.exists()) {
      tx.set(target, {
        itemId: item.id,
        quantity: qty,
        equipped: false,
        equipmentSlot: null,
        acquiredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }
    const current = snapshot.data() as InventoryItem;
    if (current.equipped)
      throw new Error(
        "Desequipe esta unidade antes de adicionar outras à pilha.",
      );
    const next = current.quantity + qty;
    if (next > item.maxStack)
      throw new Error(`A pilha excederia o máximo de ${item.maxStack}.`);
    tx.update(target, { quantity: next, updatedAt: serverTimestamp() });
  });
}
export async function setQuantity(
  cid: string,
  entry: InventoryItem,
  item: ItemDefinition,
  qty: number,
) {
  qty = Math.floor(qty);
  if (qty <= 0) return deleteDoc(doc(inv(cid), entry.id));
  if (!item.stackable && qty !== 1)
    throw new Error("Item não empilhável só aceita quantidade 1.");
  if (entry.equipped && qty !== 1)
    throw new Error("Desequipe o item antes de aumentar sua quantidade.");
  if (qty > item.maxStack)
    throw new Error(`Máximo permitido: ${item.maxStack}.`);
  return updateDoc(doc(inv(cid), entry.id), {
    quantity: qty,
    updatedAt: serverTimestamp(),
  });
}
export const removeInventoryItem = (cid: string, id: string) =>
  deleteDoc(doc(inv(cid), id));
