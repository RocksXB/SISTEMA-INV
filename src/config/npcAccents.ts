export const npcAccents = {
  cyan: ["Ciano", "#55e7ff"],
  violet: ["Violeta", "#c9a4ff"],
  amber: ["Âmbar", "#ffd180"],
  green: ["Verde", "#82f2bd"],
  rose: ["Rosa", "#ffa1b8"],
  blue: ["Azul", "#8bbaff"],
  indigo: ["Índigo", "#aaaaff"],
  magenta: ["Magenta", "#f6a1f3"],
  crimson: ["Carmim", "#ff818f"],
  copper: ["Cobre", "#f7a471"],
  gold: ["Dourado", "#f5e17d"],
  lime: ["Lima", "#c5ed81"],
  teal: ["Turquesa", "#69dbcf"],
  silver: ["Prata", "#c9d9e7"],
} as const;

export type NpcAccent = keyof typeof npcAccents;

export function isNpcAccent(value: unknown): value is NpcAccent {
  return typeof value === "string" && Object.hasOwn(npcAccents, value);
}
