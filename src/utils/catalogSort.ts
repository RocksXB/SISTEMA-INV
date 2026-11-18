export type CatalogSort = "name" | "recent";
type CatalogEntry = { id: string; name: string; createdAt?: number };

export function compareCatalogEntries(order: CatalogSort, a: CatalogEntry, b: CatalogEntry) {
  const byDate = order === "recent" ? (b.createdAt ?? 0) - (a.createdAt ?? 0) : 0;
  return byDate || a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base", numeric: true }) || a.id.localeCompare(b.id);
}
