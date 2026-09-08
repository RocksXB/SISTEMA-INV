import type { EquipmentSlot } from "../types";
export const EQUIPMENT_SLOTS: ReadonlyArray<{
  value: EquipmentSlot;
  label: string;
}> = [
  { value: "head", label: "Cabeça" },
  { value: "chest", label: "Corpo" },
  { value: "hands", label: "Mãos" },
  { value: "legs", label: "Pernas" },
  { value: "feet", label: "Pés" },
  { value: "mainHand", label: "Mão principal" },
  { value: "offHand", label: "Mão secundária" },
  { value: "accessory1", label: "Acessório 1" },
  { value: "accessory2", label: "Acessório 2" },
];
export const slotLabel = (value: EquipmentSlot) =>
  EQUIPMENT_SLOTS.find((x) => x.value === value)?.label ?? value;
