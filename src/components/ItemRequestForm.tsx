import { useState, type FormEvent } from "react";
import { EQUIPMENT_SLOTS } from "../config/equipmentSlots";
import { ITEM_CATEGORIES } from "../config/itemCategories";
import { ItemRarityField } from "./ItemRarityField";
import { ItemMechanicsEditor } from "./ItemMechanicsEditor";
import { ItemSheetPreview } from "./ItemSheetContent";
import type {
  EquipmentSlot,
  ItemCategory,
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
  value: controlledValue,
  onChange,
  submitLabel,
  onSubmit,
  showQuantity = true,
}: {
  initial?: ItemRequestDraft;
  value?: ItemRequestDraft;
  onChange?: (draft: ItemRequestDraft) => void;
  submitLabel: string;
  onSubmit: (draft: ItemRequestDraft) => Promise<void>;
  showQuantity?: boolean;
}) {
  const [internalValue, setInternalValue] = useState<ItemRequestDraft>(initial);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const value = controlledValue ?? internalValue;
  const setValue = (
    next: ItemRequestDraft | ((current: ItemRequestDraft) => ItemRequestDraft),
  ) => {
    const resolved = typeof next === "function" ? next(value) : next;
    if (onChange) onChange(resolved);
    else setInternalValue(resolved);
  };
  const toggleSlot = (slot: EquipmentSlot) =>
    setValue((current) => ({
      ...current,
      allowedEquipmentSlots: current.allowedEquipmentSlots.includes(slot)
        ? current.allowedEquipmentSlots.filter((entry) => entry !== slot)
        : [...current.allowedEquipmentSlots, slot],
    }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
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
      <div className="item-form-tabs" aria-label="Visualização do cadastro">
        <button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>Cadastro</button>
        <button type="button" aria-pressed={preview} onClick={() => setPreview(true)}>Prévia da ficha</button>
      </div>
      {preview && <ItemSheetPreview item={value} />}
      <div className="item-form-fields" hidden={preview} inert={busy}>
        <label>
          Nome
          <input
            required
            value={value.name}
            onChange={(event) => setValue({ ...value, name: event.target.value })}
          />
        </label>
        <label>
          Descrição livre · opcional
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
          <ItemRarityField value={value} onChange={(changes) => setValue({ ...value, ...changes })} />
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
          {showQuantity && <label>
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
          </label>}
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
        <ItemMechanicsEditor value={value.mechanics} onChange={(mechanics) => setValue({ ...value, mechanics })} />
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
        </div>
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
      <button className="primary" disabled={busy} hidden={preview}>
        {busy ? "PROCESSANDO..." : submitLabel}
      </button>
    </form>
  );
}
