import { SKILL_TYPES } from "../config/skillTypes";
import type { SkillRequestDraft } from "../types";

const validTypes = new Set(SKILL_TYPES.map((entry) => entry.value));

export function validateSkillRequest(draft: SkillRequestDraft): string[] {
  const errors: string[] = [];
  if (!draft.name.trim()) errors.push("Informe o nome da habilidade.");
  if (!validTypes.has(draft.type)) errors.push("Selecione um tipo válido.");
  if (!Number.isFinite(draft.jetCost) || draft.jetCost < 0)
    errors.push("O custo de JET não pode ser negativo.");
  if (draft.tags.length > 10) errors.push("Use no máximo 10 tags.");
  if (draft.tags.some((tag) => !tag.trim()))
    errors.push("As tags não podem estar vazias.");
  return errors;
}
