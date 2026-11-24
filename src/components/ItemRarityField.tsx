import { Gem } from "lucide-react";
import { ARTIFACT_SERIES, ITEM_RARITIES } from "../config/itemRarities";
import type { ArtifactSeries, ItemExtras, ItemRarity } from "../types";
import "./itemMechanics.css";

export function ItemRarityField({ value, onChange }: {
  value: ItemExtras & { rarity: ItemRarity };
  onChange: (changes: ItemExtras & { rarity?: ItemRarity }) => void;
}) {
  const artifact = Boolean(value.artifactSeries);
  return (
    <div className="item-rarity-field">
      <div className="item-rarity-heading">
        <span>{artifact ? "Série do artefato" : "Raridade"}</span>
        <button type="button" className="artifact-toggle" aria-pressed={artifact}
          onClick={() => onChange({ artifactSeries: artifact ? null : "bronze" })}>
          <Gem aria-hidden="true" /> Artefato
        </button>
      </div>
      {artifact ? (
        <select aria-label="Série do artefato" value={value.artifactSeries!}
          onChange={(event) => onChange({ artifactSeries: event.target.value as ArtifactSeries })}>
          {ARTIFACT_SERIES.map((entry) => <option value={entry.value} key={entry.value}>{entry.label}</option>)}
        </select>
      ) : (
        <select aria-label="Raridade" value={value.rarity}
          onChange={(event) => onChange({ rarity: event.target.value as ItemRarity })}>
          {ITEM_RARITIES.map((entry) => <option value={entry.value} key={entry.value}>{entry.label}</option>)}
        </select>
      )}
    </div>
  );
}
