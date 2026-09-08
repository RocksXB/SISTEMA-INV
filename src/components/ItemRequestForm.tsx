import { useState, type FormEvent } from "react";
import { EQUIPMENT_SLOTS } from "../config/equipmentSlots";
import { ITEM_CATEGORIES } from "../config/itemCategories";
import { ITEM_RARITIES } from "../config/itemRarities";
import type {
  EquipmentSlot,
  ItemCategory,
  ItemRarity,
  ItemRequestDraft,
} from "../types";
import { validateItemRequest } from "../utils/itemRequest";

export const EMPTY_REQUEST: ItemRequestDraft = {
  name: "",
  description: "",
  category: "miscellaneous",
  weight: 0,
  imageUrl: "",
  rarity: "common",
  stackable: false,
  maxStack: 1,
  equippable: false,
  allowedEquipmentSlots: [],
  tags: [],
  quantity: 1,
};

export function ItemRequestForm({
  initial = EMPTY_REQUEST,
  submitLabel,
  onSubmit,
}: {
  initial?: ItemRequestDraft;
  submitLabel: string;
  onSubmit: (draft: ItemRequestDraft) => Promise<void>;
}) {
  const [value, setValue] = useState<ItemRequestDraft>(initial);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const toggleSlot = (slot: EquipmentSlot) =>
    setValue((current) => ({
      ...current,
      allowedEquipmentSlots: current.allowedEquipmentSlots.includes(slot)
        ? current.allowedEquipmentSlots.filter((entry) => entry !== slot)
        : [...current.allowedEquipmentSlots, slot],
    }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    const errors = validateItemRequest(value);
    if (errors.length) return setError(errors[0]);
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await onSubmit(value);
      setSuccess("DADOS REGISTRADOS COM SUCESSO");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Não foi possível salvar.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="admin-form request-form" onSubmit={submit}>
      <label>
        Nome
        <input
          required
          value={value.name}
          onChange={(event) => setValue({ ...value, name: event.target.value })}
        />
      </label>
      <label>
        Descrição
        <textarea
          value={value.description}
          onChange={(event) =>
            setValue({ ...value, description: event.target.value })
          }
        />
      </label>
      <label>
        URL da imagem
        <input
          type="url"
          value={value.imageUrl}
          onChange={(event) =>
            setValue({ ...value, imageUrl: event.target.value })
          }
        />
      </label>
      <div className="form-grid">
        <label>
          Categoria
          <select
            value={value.category}
            onChange={(event) =>
              setValue({
                ...value,
                category: event.target.value as ItemCategory,
              })
            }
          >
            {ITEM_CATEGORIES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Raridade
          <select
            value={value.rarity}
            onChange={(event) =>
              setValue({
                ...value,
                rarity: event.target.value as ItemRarity,
              })
            }
          >
            {ITEM_RARITIES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Peso unitário (kg)
          <input
            type="number"
            min="0"
            step="0.001"
            required
            value={value.weight}
            onChange={(event) =>
              setValue({ ...value, weight: Number(event.target.value) })
            }
          />
        </label>
        <label>
          Quantidade
          <input
            type="number"
            min="1"
            step="1"
            required
            value={value.quantity}
            onChange={(event) =>
              setValue({ ...value, quantity: Number(event.target.value) })
            }
          />
        </label>
        <label>
          Máximo da pilha
          <input
            type="number"
            min="1"
            step="1"
            required
            disabled={!value.stackable}
            value={value.maxStack}
            onChange={(event) =>
              setValue({ ...value, maxStack: Number(event.target.value) })
            }
          />
        </label>
      </div>
      <div className="checks">
        <label>
          <input
            type="checkbox"
            checked={value.stackable}
            onChange={(event) =>
              setValue({
                ...value,
                stackable: event.target.checked,
                maxStack: event.target.checked
                  ? Math.max(1, value.maxStack)
                  : 1,
              })
            }
          />
          Empilhável
        </label>
        <label>
          <input
            type="checkbox"
            checked={value.equippable}
            onChange={(event) =>
              setValue({
                ...value,
                equippable: event.target.checked,
                allowedEquipmentSlots: event.target.checked
                  ? value.allowedEquipmentSlots
                  : [],
              })
            }
          />
          Equipável
        </label>
      </div>
      {value.equippable && (
        <fieldset>
          <legend>Slots permitidos</legend>
          {EQUIPMENT_SLOTS.map((slot) => (
            <label key={slot.value}>
              <input
                type="checkbox"
                checked={value.allowedEquipmentSlots.includes(slot.value)}
                onChange={() => toggleSlot(slot.value)}
              />
              {slot.label}
            </label>
          ))}
        </fieldset>
      )}
      <label>
        Tags (separadas por vírgula)
        <input
          value={value.tags.join(", ")}
          onChange={(event) =>
            setValue({
              ...value,
              tags: event.target.value
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            })
          }
        />
      </label>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="form-success" role="status">
          {success}
        </div>
      )}
      <button className="primary" disabled={busy}>
        {busy ? "PROCESSANDO..." : submitLabel}
      </button>
    </form>
  );
}
