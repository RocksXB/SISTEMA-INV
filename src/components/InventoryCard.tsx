import { Box, CheckCircle2 } from "lucide-react";
import { categoryLabel } from "../config/itemCategories";
import { rarityConfig } from "../config/itemRarities";
import type { HydratedInventoryItem } from "../types";
import { calculateStackWeight, formatWeight } from "../utils/inventory";
export function InventoryCard({
  entry,
  onClick,
}: {
  entry: HydratedInventoryItem;
  onClick: () => void;
}) {
  const i = entry.definition,
    r = rarityConfig(i.rarity);
  return (
    <button className={`item-card ${r.className}`} onClick={onClick}>
      <div className="item-image">
        {i.imageUrl ? <img src={i.imageUrl} alt="" /> : <Box />}
        {entry.equipped ? (
          <span className="equipped">
            <CheckCircle2 /> EQUIPADO
          </span>
        ) : entry.carried === false ? (
          <span className="equipped">
            <Box /> FORA DA CARGA
          </span>
        ) : null}
      </div>
      <div className="item-content">
        <small>{categoryLabel(i.category)}</small>
        <b>{entry.customName || i.name}</b>
        <div>
          <span>×{entry.quantity}</span>
          <span>
            {formatWeight(calculateStackWeight(i.weight, entry.quantity))}
          </span>
        </div>
        <em>{r.label}</em>
      </div>
    </button>
  );
}
