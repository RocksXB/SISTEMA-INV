import { ARTIFACT_SERIES } from "../config/itemRarities";
import type { ItemExtras, ItemMechanics } from "../types";

export const MAX_ITEM_ABILITIES = 12;
export const EMPTY_ITEM_MECHANICS: ItemMechanics = {
  type: "", attunement: "", baseDamage: "", charges: "", activationCost: "",
  exhaustion: "", risks: "", abilities: [],
};

export function validateItemExtras(item: ItemExtras): string[] {
  if (item.artifactSeries != null && !ARTIFACT_SERIES.some((entry) => entry.value === item.artifactSeries)) {
    return ["Selecione uma série de artefato válida."];
  }
  if (item.mechanics === undefined) return [];
  const mechanics = item.mechanics;
  if (!mechanics || !Array.isArray(mechanics.abilities) || mechanics.abilities.length > MAX_ITEM_ABILITIES) {
    return [`Use até ${MAX_ITEM_ABILITIES} habilidades por item.`];
  }
  for (const field of ["type", "attunement", "baseDamage", "charges", "activationCost"] as const) {
    if (typeof mechanics[field] !== "string" || mechanics[field].length > 300) {
      return ["Use até 300 caracteres em cada característica do item."];
    }
  }
  if (typeof mechanics.exhaustion !== "string" || typeof mechanics.risks !== "string" ||
      mechanics.exhaustion.length > 8000 || mechanics.risks.length > 8000) {
    return ["Use até 8.000 caracteres em exaustão e riscos."];
  }
  const ids = new Set<string>();
  for (const ability of mechanics.abilities) {
    if (!ability || typeof ability.id !== "string" || !ability.id || ability.id.length > 80 || ids.has(ability.id) ||
        !["active", "passive"].includes(ability.type)) {
      return ["Há uma habilidade com identificação ou tipo inválido."];
    }
    ids.add(ability.id);
    if (typeof ability.name !== "string" || !ability.name.trim() || ability.name.length > 150) {
      return ["Dê um nome de até 150 caracteres a cada habilidade."];
    }
    if (typeof ability.effect !== "string" || ability.effect.length > 8000) {
      return ["Use até 8.000 caracteres no efeito de cada habilidade."];
    }
    for (const field of ["cost", "roll", "damageType", "duration", "cooldown"] as const) {
      if (typeof ability[field] !== "string" || ability[field].length > 300) {
        return ["Use até 300 caracteres nos campos de custo, rolagem, dano, duração e recarga."];
      }
    }
  }
  return [];
}

export function readItemData(value: Record<string, unknown>) {
  const { mechanics, artifactSeries, ...data } = value;
  const hasSeries = artifactSeries == null || ARTIFACT_SERIES.some((entry) => entry.value === artifactSeries);
  const hasMechanics = mechanics !== undefined &&
    validateItemExtras({ mechanics: mechanics as ItemMechanics }).length === 0;
  return {
    ...data,
    ...(artifactSeries !== undefined && hasSeries ? { artifactSeries } : {}),
    ...(hasMechanics ? { mechanics } : {}),
  };
}
