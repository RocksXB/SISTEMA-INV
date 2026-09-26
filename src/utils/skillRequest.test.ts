import { describe, expect, it } from "vitest";
import type { SkillRequestDraft } from "../types";
import { validateSkillRequest } from "./skillRequest";

const valid: SkillRequestDraft = {
  name: "Railgun",
  type: "technique",
  description: "Disparo eletromagnético.",
  jetCost: 120,
  cooldown: "2 turnos",
  duration: "Instantânea",
  damage: "3d20 + PRE",
  effect: "Perfura a linha de tiro.",
  conditions: "",
  imageUrl: "",
  tags: ["elétrico", "distância"],
};

describe("validateSkillRequest", () => {
  it("aceita uma técnica válida", () => {
    expect(validateSkillRequest(valid)).toEqual([]);
  });

  it("rejeita nome vazio e JET negativo", () => {
    const result = validateSkillRequest({ ...valid, name: " ", jetCost: -1 });
    expect(result).toContain("Informe o nome da habilidade.");
    expect(result).toContain("O custo de JET não pode ser negativo.");
  });

  it("limita tags", () => {
    expect(
      validateSkillRequest({
        ...valid,
        tags: Array.from({ length: 11 }, (_, index) => `tag-${index}`),
      }),
    ).toContain("Use no máximo 10 tags.");
  });
});
