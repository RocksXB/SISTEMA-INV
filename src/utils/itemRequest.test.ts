import { describe, expect, it } from "vitest";
import type { ItemRequestDraft } from "../types";
import { EMPTY_ITEM_MECHANICS, readItemData } from "./itemMechanics";
import { itemRarityConfig } from "../config/itemRarities";
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
  it("preserva a descrição antiga e transporta série e habilidades até o catálogo", () => {
    const draft: ItemRequestDraft = {
      ...valid,
      description: "Descrição antiga\ncom suas quebras de linha.",
      artifactSeries: "platinum",
      mechanics: {
        ...EMPTY_ITEM_MECHANICS,
        abilities: [{
          id: "crimson", name: "Crimson Scissor", type: "active", effect: "Aplica sangramento.",
          cost: "1 Trava", roll: "5d12 + PRE", damageType: "Corte", duration: "Instantâneo", cooldown: "",
        }],
      },
    };
    expect(validateItemRequest(draft)).toEqual([]);
    const definition = buildItemDefinitionFromRequest("artifact", draft);
    expect(definition.description).toBe(draft.description);
    expect(definition.mechanics).toEqual(draft.mechanics);
    expect(itemRarityConfig(definition).label).toBe("Série Platina");
    expect(itemRarityConfig(valid).label).toBe("Raro");
    expect(itemRarityConfig({ ...valid, artifactSeries: null }).label).toBe("Raro");
    expect(validateItemRequest({
      ...draft, mechanics: { ...draft.mechanics!, abilities: [{ ...draft.mechanics!.abilities[0], name: "" }] },
    })).toHaveLength(1);
    expect(readItemData({
      ...draft, mechanics: { ...draft.mechanics, abilities: [{ ...draft.mechanics!.abilities[0], roll: 5 }] },
    })).toEqual(expect.objectContaining({ description: draft.description, artifactSeries: "platinum" }));
    expect(readItemData({
      ...draft, mechanics: { ...draft.mechanics, abilities: [{ ...draft.mechanics!.abilities[0], roll: 5 }] },
    })).not.toHaveProperty("mechanics");
  });
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
