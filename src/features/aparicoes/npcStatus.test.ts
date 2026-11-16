import { describe, expect, it } from "vitest";
import { npcCardStatus, specialStatus } from "./npcStatus";

describe("status visual de Aparições", () => {
  it("reconhece fichas antigas sem reescrever seu conteúdo", () => {
    expect(specialStatus("[MORTO 15/06/2227]")).toBe("morto");
    expect(specialStatus("Falecida")).toBe("morto");
    expect(specialStatus("Não está morto")).toBeUndefined();
  });

  it("aplica o visual divino por ficha ou tópico e prioriza o status da ficha", () => {
    expect(npcCardStatus([["Status", "Divindade"]], "Nova Europa")).toBe("divindade");
    expect(npcCardStatus([], "Panteão das Divindades")).toBe("divindade");
    expect(npcCardStatus([["Status", "MORTO"]], "Divindades")).toBe("morto");
    expect(npcCardStatus([["Tipo", "Divindade"]], "Nova África")).toBeUndefined();
  });
});
