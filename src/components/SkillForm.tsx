import { useState, type FormEvent } from "react";
import { SKILL_TYPES } from "../config/skillTypes";
import type { SkillRequestDraft, SkillType } from "../types";
import { validateSkillRequest } from "../utils/skillRequest";

export const EMPTY_SKILL_REQUEST: SkillRequestDraft = {
  name: "",
  type: "ability",
  description: "",
  jetCost: 0,
  cooldown: "",
  duration: "",
  damage: "",
  effect: "",
  conditions: "",
  imageUrl: "",
  tags: [],
};

export function SkillForm({
  initial = EMPTY_SKILL_REQUEST,
  value: controlledValue,
  onChange,
  submitLabel,
  onSubmit,
}: {
  initial?: SkillRequestDraft;
  value?: SkillRequestDraft;
  onChange?: (draft: SkillRequestDraft) => void;
  submitLabel: string;
  onSubmit: (draft: SkillRequestDraft) => Promise<void>;
}) {
  const [internalValue, setInternalValue] =
    useState<SkillRequestDraft>(initial);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const value = controlledValue ?? internalValue;

  const setValue = (
    next: SkillRequestDraft | ((current: SkillRequestDraft) => SkillRequestDraft),
  ) => {
    const resolved = typeof next === "function" ? next(value) : next;
    if (onChange) onChange(resolved);
    else setInternalValue(resolved);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    const errors = validateSkillRequest(value);
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
    <form className="admin-form skill-form" onSubmit={submit}>
      <div className="form-grid">
        <label>
          Nome
          <input
            required
            value={value.name}
            onChange={(event) => setValue({ ...value, name: event.target.value })}
          />
        </label>
        <label>
          Tipo
          <select
            value={value.type}
            onChange={(event) =>
              setValue({ ...value, type: event.target.value as SkillType })
            }
          >
            {SKILL_TYPES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      </div>
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
          Custo de JET
          <input
            required
            type="number"
            min="0"
            step="1"
            value={value.jetCost}
            onChange={(event) =>
              setValue({ ...value, jetCost: Number(event.target.value) })
            }
          />
        </label>
        <label>
          Cooldown
          <input
            placeholder="Ex.: 2 turnos / 1 vez por combate"
            value={value.cooldown}
            onChange={(event) =>
              setValue({ ...value, cooldown: event.target.value })
            }
          />
        </label>
        <label>
          Duração
          <input
            placeholder="Ex.: Instantânea / 3 turnos"
            value={value.duration}
            onChange={(event) =>
              setValue({ ...value, duration: event.target.value })
            }
          />
        </label>
        <label>
          Dano / rolagem
          <input
            placeholder="Ex.: 3d20 + PRE"
            value={value.damage}
            onChange={(event) =>
              setValue({ ...value, damage: event.target.value })
            }
          />
        </label>
      </div>
      <label>
        Efeito
        <textarea
          value={value.effect}
          onChange={(event) =>
            setValue({ ...value, effect: event.target.value })
          }
        />
      </label>
      <label>
        Condições / limitações
        <textarea
          value={value.conditions}
          onChange={(event) =>
            setValue({ ...value, conditions: event.target.value })
          }
        />
      </label>
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
