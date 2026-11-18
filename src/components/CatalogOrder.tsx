import { ArrowDownAZ } from "lucide-react";
import type { CatalogSort } from "../utils/catalogSort";
import "./catalogOrder.css";

export function CatalogOrder({ value, onChange }: { value: CatalogSort; onChange: (value: CatalogSort) => void }) {
  return (
    <label className="catalog-order">
      <ArrowDownAZ aria-hidden="true" />
      <select aria-label="Ordenar por" value={value}
        onChange={(event) => onChange(event.target.value === "recent" ? "recent" : "name")}>
        <option value="name">Ordem alfabética</option>
        <option value="recent">Mais recentes</option>
      </select>
    </label>
  );
}
