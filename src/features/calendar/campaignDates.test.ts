import { describe, expect, it } from "vitest";
import { initialCampaignDate, nextCampaignDay, parseCampaignDate } from "./campaignDates";
import { birthdayInYear, npcAgeLabel, npcBirthday, parseBirthday } from "./npcBirthdays";

describe("calendário da campanha", () => {
  it("avança no mesmo calendário, inclusive por meses, anos e dias bissextos", () => {
    expect(nextCampaignDay(initialCampaignDate)).toBe("2227-07-12");
    expect(nextCampaignDay("2227-12-31")).toBe("2228-01-01");
    expect(nextCampaignDay("2228-02-28")).toBe("2228-02-29");
    expect(nextCampaignDay("2227-02-28")).toBe("2227-03-01");
    expect(parseCampaignDate("2227-07-32")).toBeUndefined();
  });

  it("usa a idade antiga como referência para aniversários antes e depois da data inicial", () => {
    const march = { fields: [["Idade", "27/03 (20 anos)"]] as [string, string][] };
    const august = { fields: [["Idade", "14/08 (24 anos)"]] as [string, string][] };
    expect(npcAgeLabel(march, parseCampaignDate("2228-03-26")!)).toBe("20 anos");
    expect(npcAgeLabel(march, parseCampaignDate("2228-03-27")!)).toBe("21 anos");
    expect(npcAgeLabel(august, parseCampaignDate("2227-08-14")!)).toBe("25 anos");
    expect(npcAgeLabel(august, parseCampaignDate("2230-08-14")!)).toBe("28 anos");
  });

  it("prioriza nascimento explícito e usa a data registrada na edição para novas idades", () => {
    const fields: [string, string][] = [["Idade", "27/03 (20 anos)"], ["Aniversário", "14/08"]];
    expect(npcBirthday(fields)).toEqual({ day: 14, month: 8, year: undefined });
    expect(npcAgeLabel({ fields, ageReferenceDate: "2228-08-01" }, parseCampaignDate("2228-08-14")!)).toBe("21 anos");
    expect(npcAgeLabel({ fields: [["Idade", "15/06/2183 (45 anos)."]] }, parseCampaignDate(initialCampaignDate)!)).toBe("44 anos");
    expect(npcAgeLabel({ fields: [["Idade", "19/10 (7/18 anos humanos)"]] }, parseCampaignDate(initialCampaignDate)!)).toBeUndefined();
  });

  it("exibe datas válidas sem inventar uma idade", () => {
    expect(npcBirthday([["Idade", "??/?? (? anos)"]])).toBeUndefined();
    expect(npcBirthday([["Idade", "02/06 ()"]])?.day).toBe(2);
    expect(parseBirthday("31/06")).toBeUndefined();
    expect(birthdayInYear(parseBirthday("29/02/2228")!, 2227)).toBeUndefined();
    expect(birthdayInYear(parseBirthday("29/02")!, 2227)).toBe("2227-03-01");
  });
});
