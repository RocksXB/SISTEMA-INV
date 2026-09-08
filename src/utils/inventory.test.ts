import { describe, expect, it } from "vitest";
import {
  calculateEncumbrancePercentage,
  calculateInventoryWeight,
  calculateStackWeight,
  canEquipItem,
  formatWeight,
  getEncumbranceStatus,
} from "./inventory";
import type { InventoryItem, ItemDefinition } from "../types";
const sword: ItemDefinition = {
  id: "sword",
  name: "Katana",
  description: "",
  category: "weapon",
  weight: 2.1,
  rarity: "rare",
  stackable: false,
  maxStack: 1,
  equippable: true,
  allowedEquipmentSlots: ["mainHand"],
  tags: [],
};
const entry: InventoryItem = {
  id: "one",
  itemId: "sword",
  quantity: 1,
  equipped: false,
  equipmentSlot: null,
};
describe("peso", () => {
  it("calcula pilha e inventário sem perder precisão", () => {
    expect(calculateStackWeight(0.012, 40)).toBeCloseTo(0.48);
    expect(
      calculateInventoryWeight([{ quantity: 3, definition: sword }]),
    ).toBeCloseTo(6.3);
    expect(formatWeight(42.700000001)).toBe("42.7 kg");
  });
  it("calcula percentual e faixas", () => {
    expect(calculateEncumbrancePercentage(35, 70)).toBe(50);
    expect(getEncumbranceStatus(49.99)).toBe("normal");
    expect(getEncumbranceStatus(50)).toBe("loaded");
    expect(getEncumbranceStatus(75)).toBe("heavy");
    expect(getEncumbranceStatus(100)).toBe("overloaded");
  });
});
describe("equipamento", () => {
  it("aceita slot compatível e vazio", () =>
    expect(canEquipItem(sword, "mainHand", [entry], entry.id).allowed).toBe(
      true,
    ));
  it("bloqueia incompatibilidade, pilha, item não equipável e slot ocupado", () => {
    expect(canEquipItem(sword, "head", []).allowed).toBe(false);
    expect(
      canEquipItem(sword, "mainHand", [{ ...entry, quantity: 2 }], entry.id)
        .allowed,
    ).toBe(false);
    expect(
      canEquipItem({ ...sword, equippable: false }, "mainHand", []).allowed,
    ).toBe(false);
    expect(
      canEquipItem(sword, "mainHand", [
        { ...entry, equipped: true, equipmentSlot: "mainHand" },
      ]).allowed,
    ).toBe(false);
  });
});
