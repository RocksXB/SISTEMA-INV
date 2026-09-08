import { EQUIPMENT_SLOTS } from "../config/equipmentSlots";
import type {
  InventoryItem,
  ItemDefinition,
  ItemRequest,
  ItemRequestDraft,
  UserRole,
} from "../types";

const validSlots = new Set(EQUIPMENT_SLOTS.map((slot) => slot.value));

export function validateItemRequest(
  request: ItemRequestDraft,
  itemForApproval?: ItemDefinition,
): string[] {
  const value = itemForApproval ?? request;
  const errors: string[] = [];
  if (!request.name.trim()) errors.push("Informe o nome do item.");
  if (!Number.isInteger(request.quantity) || request.quantity < 1)
    errors.push("A quantidade deve ser um inteiro maior ou igual a 1.");
  if (!Number.isFinite(value.weight) || value.weight < 0)
    errors.push("O peso não pode ser negativo.");
  if (!Number.isInteger(value.maxStack) || value.maxStack < 1)
    errors.push("O máximo da pilha deve ser um inteiro positivo.");
  if (!value.stackable && value.maxStack !== 1)
    errors.push("Itens não empilháveis devem ter pilha máxima 1.");
  if (value.stackable && request.quantity > value.maxStack)
    errors.push(`A quantidade excede a pilha máxima de ${value.maxStack}.`);
  if (!value.equippable && value.allowedEquipmentSlots.length)
    errors.push("Itens não equipáveis não podem possuir slots.");
  if (
    value.equippable &&
    (!value.allowedEquipmentSlots.length ||
      value.allowedEquipmentSlots.some((slot) => !validSlots.has(slot)))
  )
    errors.push("Selecione pelo menos um slot de equipamento válido.");
  return errors;
}

export function assertRequestAction(
  role: UserRole,
  action: "approve" | "reject" | "delete",
  request: Pick<ItemRequest, "status">,
) {
  if (action !== "delete" && role !== "admin")
    throw new Error("Apenas administradores podem revisar solicitações.");
  if (action !== "delete" && request.status !== "pending")
    throw new Error("Esta solicitação já foi revisada.");
}

export function canPlayerRequestCharacter(ownerId: string, uid: string) {
  return ownerId === uid;
}

export function calculateApprovedStackQuantity(
  existing: Pick<InventoryItem, "quantity" | "equipped"> | null,
  requestedQuantity: number,
  maxStack: number,
) {
  if (existing?.equipped)
    throw new Error(
      "Desequipe o item existente antes de aprovar novas unidades.",
    );
  const next = (existing?.quantity ?? 0) + requestedQuantity;
  if (next > maxStack)
    throw new Error(
      `A quantidade aprovada excederia a pilha máxima de ${maxStack}.`,
    );
  return next;
}

export const approvalCreatesCatalogItem = (mode: "new" | "existing") =>
  mode === "new";

export function buildItemDefinitionFromRequest(
  id: string,
  draft: ItemRequestDraft,
): ItemDefinition {
  const { quantity: _quantity, ...definition } = draft;
  void _quantity;
  return { id, ...definition };
}

export function buildInventoryGrants(
  itemId: string,
  quantity: number,
  stackable: boolean,
) {
  return stackable
    ? [{ itemId, quantity }]
    : Array.from({ length: quantity }, () => ({ itemId, quantity: 1 }));
}
