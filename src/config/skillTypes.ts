import type { SkillType } from "../types";

export const SKILL_TYPES: ReadonlyArray<{ value: SkillType; label: string }> = [
  { value: "ability", label: "Habilidade" },
  { value: "technique", label: "Técnica" },
  { value: "passive", label: "Passiva" },
  { value: "ultimate", label: "Ultimate" },
  { value: "transformation", label: "Transformação" },
  { value: "domain", label: "Domínio" },
  { value: "other", label: "Outra" },
];

export const skillTypeLabel = (value: SkillType) =>
  SKILL_TYPES.find((entry) => entry.value === value)?.label ?? value;
