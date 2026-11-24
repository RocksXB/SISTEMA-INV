import { BatteryLow, Sparkles, Swords } from "lucide-react";
import { itemRarityConfig } from "../config/itemRarities";
import type { ItemAbility, ItemDefinition } from "../types";
import { formatWeight } from "../utils/inventory";
import "./itemMechanics.css";

type ItemSheet = Pick<ItemDefinition, "name" | "description" | "rarity" | "mechanics" | "artifactSeries" | "imageUrl" | "weight">;

function Ability({ ability }: { ability: ItemAbility }) {
  const metadata = [
    ["Rolagem", ability.roll], ["Dano", ability.damageType],
    ["Duração", ability.duration], ["Recarga", ability.cooldown],
  ].filter(([, value]) => value.trim());
  return (
    <article className={ability.type === "passive" ? "item-passive" : "item-active-ability"}>
      <header>
        <h4>{ability.name}</h4>
        {ability.cost.trim() && <span className="item-ability-cost">Custo · {ability.cost}</span>}
      </header>
      {ability.effect.trim() && <p>{ability.effect}</p>}
      {metadata.length > 0 && <dl className="item-ability-meta">{metadata.map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
      ))}</dl>}
    </article>
  );
}

export function ItemSheetContent({ item }: { item: ItemSheet }) {
  const mechanics = item.mechanics;
  const characteristics = mechanics ? [
    ["Tipo", mechanics.type], ["Sintonia", mechanics.attunement], ["Dano base", mechanics.baseDamage],
    ["Travas / cargas", mechanics.charges], ["Ativação", mechanics.activationCost],
  ].filter(([, value]) => value.trim()) : [];
  const active = mechanics?.abilities.filter((ability) => ability.type === "active") ?? [];
  const passive = mechanics?.abilities.filter((ability) => ability.type === "passive") ?? [];
  return (
    <div className="item-sheet-content">
      {characteristics.length > 0 && <dl className="item-characteristic-grid">{characteristics.map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
      ))}</dl>}
      {item.description && <section className="item-description">
        <h3>Descrição</h3><p>{item.description}</p>
      </section>}
      {active.length > 0 && <section className="item-ability-section">
        <h3><Swords aria-hidden="true" /> Habilidades ativas</h3>
        {active.map((ability) => <Ability key={ability.id} ability={ability} />)}
      </section>}
      {passive.length > 0 && <section className="item-ability-section">
        <h3><Sparkles aria-hidden="true" /> Passivas</h3>
        {passive.map((ability) => <Ability key={ability.id} ability={ability} />)}
      </section>}
      {mechanics?.exhaustion.trim() && <section className="item-condition">
        <h3><BatteryLow aria-hidden="true" /> Exaustão</h3><p>{mechanics.exhaustion}</p>
      </section>}
      {mechanics?.risks.trim() && <section className="item-condition item-risk">
        <h3>Riscos</h3><p>{mechanics.risks}</p>
      </section>}
    </div>
  );
}

export function ItemSheetPreview({ item }: { item: ItemSheet }) {
  const rarity = itemRarityConfig(item);
  return (
    <article className="item-sheet-preview">
      <header className={`item-sheet-preview-heading ${rarity.className}`}>
        <span>{item.artifactSeries ? "Artefato · " : ""}{rarity.label}</span>
        <h3>{item.name || "Novo item"}</h3>
        <small>{formatWeight(item.weight)}</small>
      </header>
      {item.imageUrl && <img className="item-sheet-preview-image" src={item.imageUrl} alt="" />}
      <ItemSheetContent item={item} />
    </article>
  );
}
