import type { Npc } from "../../services/aparicoesService";
import { dateKey, daysInMonth, initialCampaignDate, padDay, parseCampaignDate, type CampaignDate } from "./campaignDates";

type Fields = ReadonlyArray<readonly [string, string]>;
export type Birthday = { day: number; month: number; year?: number };
const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

export function isBirthdayField(label: string) {
  return ["aniversario", "data de nascimento"].includes(normalize(label));
}

export function isAgeField(label: string) {
  return normalize(label) === "idade";
}

export function birthText(fields: Fields) {
  return fields.find(([label, value]) => isBirthdayField(label) && value.trim())?.[1].trim() || "";
}

export function ageText(fields: Fields) {
  return fields.find(([label, value]) => isAgeField(label) && value.trim())?.[1].trim() || "";
}

export function parseBirthday(value: string): Birthday | undefined {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (!match) return;
  const day = Number(match[1]), month = Number(match[2]), year = match[3] ? Number(match[3]) : undefined;
  if (year === 0 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year ?? 2000, month)) return;
  return { day, month, year };
}

export function npcBirthday(fields: Fields) {
  const ageDate = ageText(fields).match(/^\d{1,2}\/\d{1,2}(?:\/\d{4})?(?=$|[\s.(])/)?.[0] || "";
  return parseBirthday(birthText(fields)) || parseBirthday(ageDate);
}

export function birthdayLabel(birthday: Birthday) {
  return `${padDay(birthday.day)}/${padDay(birthday.month)}${birthday.year ? "/" + String(birthday.year).padStart(4, "0") : ""}`;
}

const beforeBirthday = (date: CampaignDate, birth: Birthday) =>
  date.month < birth.month || (date.month === birth.month && date.day < birth.day);

export function npcAgeLabel(npc: Pick<Npc, "fields" | "ageReferenceDate">, date: CampaignDate) {
  const birthday = npcBirthday(npc.fields);
  if (!birthday) return;
  let year = birthday.year;
  if (year === undefined) {
    const written = ageText(npc.fields);
    const recorded = written.match(/\(\s*(\d{1,4})\s*anos?\b/) || written.match(/^(\d{1,4})(?:\s+anos?)?\.?$/i);
    const reference = parseCampaignDate(npc.ageReferenceDate || initialCampaignDate);
    if (!recorded || !reference) return;
    year = reference.year - Number(recorded[1]) - Number(beforeBirthday(reference, birthday));
  }
  const age = date.year - year - Number(beforeBirthday(date, birthday));
  return age < 0 ? "Ainda não nasceu" : `${age} ${age === 1 ? "ano" : "anos"}`;
}

export function birthdayInYear(birthday: Birthday, year: number) {
  if (birthday.year && birthday.year > year) return;
  if (birthday.month === 2 && birthday.day === 29 && daysInMonth(year, 2) === 28) {
    return dateKey({ year, month: 3, day: 1 });
  }
  return dateKey({ ...birthday, year });
}
