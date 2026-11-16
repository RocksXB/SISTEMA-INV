export const initialCampaignDate = "2227-07-11";
export const months = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export type CampaignDate = { year: number; month: number; day: number };

export function daysInMonth(year: number, month: number) {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export const padDay = (value: number) => String(value).padStart(2, "0");

export function dateKey({ year, month, day }: CampaignDate) {
  return `${String(year).padStart(4, "0")}-${padDay(month)}-${padDay(day)}`;
}

export function parseCampaignDate(value: unknown): CampaignDate | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return;
  return { year, month, day };
}

export function nextCampaignDay(date: string) {
  const current = parseCampaignDate(date);
  if (!current) return;
  const { year, month, day } = current;
  if (day < daysInMonth(year, month)) return dateKey({ year, month, day: day + 1 });
  if (month < 12) return dateKey({ year, month: month + 1, day: 1 });
  if (year < 9999) return dateKey({ year: year + 1, month: 1, day: 1 });
}

export function firstWeekday(year: number, month: number) {
  return new Date(dateKey({ year, month, day: 1 }) + "T00:00:00Z").getUTCDay();
}

export function campaignDateLabel(date: CampaignDate) {
  return `${date.day} de ${months[date.month - 1]} de ${date.year}`;
}
