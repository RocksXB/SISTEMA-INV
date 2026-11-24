import type { ArtifactSeries, ItemExtras, ItemRarity } from "../types";
export const ITEM_RARITIES: ReadonlyArray<{
  value: ItemRarity;
  label: string;
  priority: number;
  className: string;
}> = [
  { value: "common", label: "Comum", priority: 1, className: "rarity-common" },
  {
    value: "uncommon",
    label: "Incomum",
    priority: 2,
    className: "rarity-uncommon",
  },
  { value: "rare", label: "Raro", priority: 3, className: "rarity-rare" },
  { value: "epic", label: "Épico", priority: 4, className: "rarity-epic" },
  {
    value: "legendary",
    label: "Lendário",
    priority: 5,
    className: "rarity-legendary",
  },
  { value: "mythic", label: "Mítico", priority: 6, className: "rarity-mythic" },
];
export const rarityConfig = (value: ItemRarity) =>
  ITEM_RARITIES.find((x) => x.value === value) ?? ITEM_RARITIES[0];

export const ARTIFACT_SERIES: ReadonlyArray<{
  value: ArtifactSeries; label: string; priority: number; className: string;
}> = [
  { value: "bronze", label: "Série Bronze", priority: 1, className: "series-bronze" },
  { value: "silver", label: "Série Prata", priority: 2, className: "series-silver" },
  { value: "gold", label: "Série Ouro", priority: 3, className: "series-gold" },
  { value: "platinum", label: "Série Platina", priority: 4, className: "series-platinum" },
  { value: "diamond", label: "Série Diamante", priority: 5, className: "series-diamond" },
  { value: "mythic", label: "Série Mítico", priority: 6, className: "series-mythic" },
];

export function itemRarityConfig(item: ItemExtras & { rarity: ItemRarity }) {
  return ARTIFACT_SERIES.find((series) => series.value === item.artifactSeries) ?? rarityConfig(item.rarity);
}
