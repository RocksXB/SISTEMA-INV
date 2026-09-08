import { describe, expect, it } from "vitest";
import type { ItemRequestDraft } from "../types";
import {
  approvalCreatesCatalogItem,
  assertRequestAction,
  buildInventoryGrants,
  buildItemDefinitionFromRequest,
  calculateApprovedStackQuantity,
  canPlayerRequestCharacter,
  validateItemRequest,
} from "./itemRequest";

const valid: ItemRequestDraft = {
  name: "Katana JET",
  description: "",
  category: "weapon",
  weight: 2.4,
  imageUrl: "",
  rarity: "rare",
  stackable: false,
  maxStack: 1,
  equippable: true,
  allowedEquipmentSlots: ["mainHand"],
  tags: ["lâmina"],
  quantity: 1,
};

describe("solicitações de item", () => {
  it("valida nome, quantidade, peso, pilha e equipamento", () => {
    expect(validateItemRequest(valid)).toEqual([]);
    expect(
      validateItemRequest({
        ...valid,
        name: " ",
        quantity: 0,
        weight: -1,
        maxStack: 2,
        equippable: false,
      }),
    ).toHaveLength(5);
  });

  it("não permite que player aprove ou solicite para personagem alheio", () => {
    expect(() =>
      assertRequestAction("player", "approve", { status: "pending" }),
    ).toThrow("Apenas administradores");
    expect(canPlayerRequestCharacter("owner-a", "owner-b")).toBe(false);
  });

  it("rejeita aprovação duplicada", () => {
    expect(() =>
      assertRequestAction("admin", "approve", { status: "approved" }),
    ).toThrow("já foi revisada");
  });

  it("vincular item existente não solicita criação no catálogo", () => {
    expect(approvalCreatesCatalogItem("existing")).toBe(false);
    expect(approvalCreatesCatalogItem("new")).toBe(true);
  });

  it("aprovação nova gera definição e entradas unitárias corretas", () => {
    const definition = buildItemDefinitionFromRequest("new-item", valid);
    expect(definition).toMatchObject({ id: "new-item", name: "Katana JET" });
    expect(definition).not.toHaveProperty("quantity");
    expect(buildInventoryGrants("new-item", 2, false)).toEqual([
      { itemId: "new-item", quantity: 1 },
      { itemId: "new-item", quantity: 1 },
    ]);
    expect(buildInventoryGrants("ammo", 40, true)).toEqual([
      { itemId: "ammo", quantity: 40 },
    ]);
  });

  it("calcula a quantidade aprovada e respeita maxStack", () => {
    expect(
      calculateApprovedStackQuantity({ quantity: 2, equipped: false }, 3, 5),
    ).toBe(5);
    expect(() =>
      calculateApprovedStackQuantity({ quantity: 4, equipped: false }, 2, 5),
    ).toThrow("pilha máxima");
  });

  it("não corrompe a quantidade de item equipado", () => {
    expect(() =>
      calculateApprovedStackQuantity({ quantity: 1, equipped: true }, 1, 10),
    ).toThrow("Desequipe");
  });
});
