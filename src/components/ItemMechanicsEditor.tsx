import { Plus, Trash2 } from "lucide-react";
import type { ItemAbility, ItemMechanics } from "../types";
import { EMPTY_ITEM_MECHANICS, MAX_ITEM_ABILITIES } from "../utils/itemMechanics";
import "./itemMechanics.css";

export function ItemMechanicsEditor({ value, onChange }: {
  value?: ItemMechanics;
  onChange: (value: ItemMechanics) => void;
}) {
  const mechanics = value ?? EMPTY_ITEM_MECHANICS;
  function updateAbility(id: string, changes: Partial<ItemAbility>) {
    onChange({ ...mechanics, abilities: mechanics.abilities.map((ability) =>
      ability.id === id ? { ...ability, ...changes } : ability) });
  }
  function addAbility() {
    const ability: ItemAbility = {
      id: crypto.randomUUID(), name: "", type: "active", effect: "", cost: "",
      roll: "", damageType: "", duration: "", cooldown: "",
    };
    onChange({ ...mechanics, abilities: [...mechanics.abilities, ability] });
  }
  return (
    <div className="item-mechanics-editor">
      <details className="item-characteristics" open={Boolean(value)}>
        <summary>Características e condições <small>opcional</small></summary>
        <div className="item-characteristics-body">
          <div className="form-grid">
            {([
              ["type", "Tipo do item", "Ex. Cimitarras gêmeas"],
              ["attunement", "Sintonia", "Ex. Nível 6"],
              ["baseDamage", "Dano base", "Ex. 2d12 + PRE por lâmina"],
              ["charges", "Travas / cargas", "Ex. 5, compartilhadas"],
              ["activationCost", "Custo de ativação", "Ex. 1 Trava por habilidade ativa"],
            ] as const).map(([field, label, placeholder]) => (
              <label key={field}>{label}
                <input value={mechanics[field]} maxLength={300} placeholder={placeholder}
                  onChange={(event) => onChange({ ...mechanics, [field]: event.target.value })} />
              </label>
            ))}
          </div>
          <label>Exaustão / condição especial
            <textarea value={mechanics.exhaustion} maxLength={8000} rows={3}
              placeholder="O que acontece quando as cargas acabam ou uma condição é atingida?"
              onChange={(event) => onChange({ ...mechanics, exhaustion: event.target.value })} />
          </label>
          <label>Riscos
            <textarea value={mechanics.risks} maxLength={8000} rows={3}
              placeholder="Consequências ou efeitos adversos do item"
              onChange={(event) => onChange({ ...mechanics, risks: event.target.value })} />
          </label>
        </div>
      </details>
      <div className="item-abilities-heading">
        <h3>Habilidades e passivas</h3>
        <button type="button" className="secondary item-add-ability" onClick={addAbility}
          disabled={mechanics.abilities.length >= MAX_ITEM_ABILITIES}>
          <Plus aria-hidden="true" /> Adicionar habilidade
        </button>
      </div>
      {mechanics.abilities.map((ability, index) => (
        <details key={ability.id} className="item-ability-editor" open>
          <summary>{ability.name || "Nova habilidade"} <small>{ability.type === "passive" ? "Passiva" : "Ativa"}</small></summary>
          <div className="item-ability-editor-body">
            <label>Nome da habilidade
              <input aria-label={`Nome da habilidade ${index + 1}`} value={ability.name} required maxLength={150}
                onChange={(event) => updateAbility(ability.id, { name: event.target.value })} />
            </label>
            <div className="form-grid">
              <label>Tipo de habilidade
                <select aria-label={`Tipo da habilidade ${index + 1}`} value={ability.type}
                  onChange={(event) => updateAbility(ability.id, { type: event.target.value as ItemAbility["type"] })}>
                  <option value="active">Ativa</option><option value="passive">Passiva</option>
                </select>
              </label>
              <label>Custo · opcional
                <input value={ability.cost} maxLength={300} placeholder="Ex. 1 Trava ou 20 JET"
                  onChange={(event) => updateAbility(ability.id, { cost: event.target.value })} />
              </label>
            </div>
            <label>Efeito
              <textarea value={ability.effect} maxLength={8000} rows={4}
                onChange={(event) => updateAbility(ability.id, { effect: event.target.value })} />
            </label>
            <div className="form-grid">
              {([
                ["roll", "Rolagem", "Ex. 5d12 + (PJT + PRE)"],
                ["damageType", "Tipo de dano", "Ex. Corte e energia"],
                ["duration", "Duração", "Ex. Instantâneo"],
                ["cooldown", "Recarga", "Ex. 3 turnos"],
              ] as const).map(([field, label, placeholder]) => (
                <label key={field}>{label} · opcional
                  <input value={ability[field]} maxLength={300} placeholder={placeholder}
                    onChange={(event) => updateAbility(ability.id, { [field]: event.target.value })} />
                </label>
              ))}
            </div>
            <button type="button" className="secondary item-remove-ability"
              aria-label={`Remover habilidade ${ability.name || index + 1}`}
              onClick={() => onChange({ ...mechanics, abilities: mechanics.abilities.filter((entry) => entry.id !== ability.id) })}>
              <Trash2 aria-hidden="true" /> Remover habilidade
            </button>
          </div>
        </details>
      ))}
    </div>
  );
}
