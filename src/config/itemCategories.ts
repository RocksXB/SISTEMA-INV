import type { ItemCategory } from "../types";
export const ITEM_CATEGORIES: ReadonlyArray<{
  value: ItemCategory;
  label: string;
}> = [
  { value: "weapon", label: "Arma" },
  { value: "armor", label: "Armadura" },
  { value: "accessory", label: "Acessório" },
  { value: "consumable", label: "Consumível" },
  { value: "tool", label: "Ferramenta" },
  { value: "material", label: "Material" },
  { value: "quest", label: "Missão" },
  { value: "miscellaneous", label: "Diversos" },
];
export const categoryLabel = (value: ItemCategory) =>
  ITEM_CATEGORIES.find((x) => x.value === value)?.label ?? value;
