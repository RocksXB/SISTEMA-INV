const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

export type NpcStatus = "morto" | "divindade";

export function isStatusField(label: string) {
  return normalize(label) === "status";
}

export function specialStatus(value: string): NpcStatus | undefined {
  const start = normalize(value).replace(/^[\s[(]+/, "");
  if (/^(mort[oa]|falecid[oa])\b/.test(start)) return "morto";
  if (/^(divindade|divin[oa])\b/.test(start)) return "divindade";
}

export function isDivineTopic(title: string) {
  return /\bdivindades?\b/.test(normalize(title));
}

export function npcCardStatus(fields: ReadonlyArray<readonly [string, string]>, topic: string) {
  for (const [label, value] of fields) {
    const status = isStatusField(label) && specialStatus(value);
    if (status) return status;
  }
  return isDivineTopic(topic) ? "divindade" : undefined;
}
