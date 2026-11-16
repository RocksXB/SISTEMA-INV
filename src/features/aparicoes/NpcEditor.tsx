import { useState, type CSSProperties, type FormEvent } from "react";
import type { User } from "firebase/auth";
import { ErrorState, Modal } from "../../components/Ui";
import { npcAccents, type NpcAccent } from "../../config/npcAccents";
import { ageText, birthdayLabel, birthText, isBirthdayField, npcBirthday, parseBirthday } from "../calendar/npcBirthdays";
import { isStatusField, specialStatus, type NpcStatus } from "./npcStatus";
import { prepareNpcPortrait, portraitSourceLimit } from "./portraitCompression";
import {
  addNpc, fetchNpcImage, portraitSrc, saveNpc,
  type Npc, type NpcField, type NpcTopic,
} from "../../services/aparicoesService";

type PhotoChoice = "manter" | "arquivo" | "link" | "original";

export function NpcEditor({ npc, user, topics, creating, campaignDate, onClose, onSave }: {
  npc: Npc;
  user: User;
  topics: NpcTopic[];
  creating: boolean;
  campaignDate: string;
  onClose: () => void;
  onSave: (npc: Npc) => void;
}) {
  const [name, setName] = useState(npc.name);
  const [topic, setTopic] = useState(npc.topicId);
  const [birthday, setBirthday] = useState(birthText(npc.fields));
  const [birthdayChanged, setBirthdayChanged] = useState(false);
  const [accent, setAccent] = useState<NpcAccent>(npc.accent || "cyan");
  const storedBirthdays = npc.fields.filter(([label]) => isBirthdayField(label));
  const inferredBirthday = !birthText(npc.fields) && npcBirthday(npc.fields);
  const [fields, setFields] = useState(() => npc.fields
    .filter(([label]) => !isBirthdayField(label)).map(([label, value], key) => ({ key, label, value })));
  const [nextKey, setNextKey] = useState(fields.length);
  const [choice, setChoice] = useState<PhotoChoice>("manter");
  const [file, setFile] = useState<File>();
  const [link, setLink] = useState("");
  const [compress, setCompress] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fieldCount = fields.length + (birthdayChanged ? Number(!!birthday.trim()) : storedBirthdays.length);
  const originalPicture = npc.originalImage || (npc.revision == null ? npc.image : undefined);
  const picture = choice === "original" ? originalPicture : npc.image;
  const statusRows = fields.filter((row) => isStatusField(row.label));
  const specialRow = statusRows.find((row) => specialStatus(row.value));
  const selectedStatus = specialRow ? specialStatus(specialRow.value) : undefined;

  function setStatus(status: "" | NpcStatus) {
    if (!status) {
      setFields((old) => old.filter((row) => !isStatusField(row.label) || !specialStatus(row.value)));
      return;
    }
    const value = status === "morto" ? "Morto" : "Divindade";
    const current = specialRow || statusRows[0];
    if (current) {
      setFields((old) => old.flatMap((row) => row.key === current.key
        ? [{ ...row, value: specialStatus(row.value) === status ? row.value : value }]
        : isStatusField(row.label) && specialStatus(row.value) ? [] : [row]));
    } else if (fieldCount < 32) {
      setFields((old) => [...old, { key: nextKey, label: "Status", value }]);
      setNextKey(nextKey + 1);
    }
  }

  function changeField(key: number, property: "label" | "value", text: string) {
    setFields((old) => old.map((row) => row.key === key ? { ...row, [property]: text } : row));
  }

  function moveField(index: number, direction: -1 | 1) {
    setFields((old) => {
      const next = [...old];
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    let trimmed: NpcField[] = fields.map(({ label, value }) => [label.trim(), value.trim()]);
    if (!name.trim() || (creating && !topic) || trimmed.some(([label]) => !label)) {
      setError("Preencha o nome do personagem, o tópico e o nome de cada campo.");
      return;
    }
    if (birthdayChanged) {
      const parsed = parseBirthday(birthday);
      if (birthday.trim() && !parsed) {
        setError("Informe um aniversário válido no formato DD/MM ou DD/MM/AAAA.");
        return;
      }
      trimmed = trimmed.filter(([label]) => !isBirthdayField(label));
      if (parsed) trimmed.push(["Aniversário", birthdayLabel(parsed)]);
    } else {
      trimmed.push(...storedBirthdays);
    }
    if (trimmed.length > 32) {
      setError("Remova um campo antes de adicionar o aniversário.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const source = choice === "link" ? await fetchNpcImage(link, portraitSourceLimit(compress)) : choice === "arquivo" ? file : undefined;
      if ((choice === "arquivo" || choice === "link") && !source?.size) {
        throw new Error("Selecione uma imagem para o retrato.");
      }
      const photo = source ? await prepareNpcPortrait(source, compress) : undefined;
      const edit = {
        name: name.trim(), accent, fields: trimmed,
        ageReferenceDate: creating || ageText(trimmed) !== ageText(npc.fields) ? campaignDate : npc.ageReferenceDate,
        imageAction: photo ? "trocar" : choice === "original" ? "original" : "manter",
      } as const;
      onSave(creating ? await addNpc(user, npc.id, topic, edit, photo) : await saveNpc(user, npc, edit, photo));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a ficha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={creating ? "Novo personagem" : "Editar ficha"} className="npc-editor" onClose={() => { if (!busy) onClose(); }}>
      <form onSubmit={save}>
        <div className="npc-editor-body">
          <fieldset disabled={busy}>
            <div className="npc-edit-settings">
              <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={150} /></label>
              {creating && <label>Tópico
                <select required value={topic} onChange={(e) => setTopic(e.target.value)}>
                  <option value="" disabled>Selecione um tópico</option>
                  {topics.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
                </select>
              </label>}
            </div>
            <label>Aniversário
              <input value={birthday} onChange={(event) => { setBirthday(event.target.value); setBirthdayChanged(true); }}
                maxLength={10} placeholder="DD/MM ou DD/MM/AAAA" autoComplete="off" />
              {inferredBirthday && <small>Data registrada na idade: {birthdayLabel(inferredBirthday)}.</small>}
            </label>
            <label className="npc-status-setting">Status
              <select value={selectedStatus || ""} onChange={(event) => setStatus(event.target.value as "" | NpcStatus)}>
                <option value="">Padrão do tópico</option>
                <option value="morto" disabled={!statusRows.length && fieldCount >= 32}>Morto</option>
                <option value="divindade" disabled={!statusRows.length && fieldCount >= 32}>Divindade</option>
              </select>
            </label>
            <fieldset className="npc-palette">
              <legend>Cor de destaque <span>{npcAccents[accent][0]}</span></legend>
              <div className="npc-swatches">
                {(Object.keys(npcAccents) as NpcAccent[]).map((color) => {
                  const [label, swatch] = npcAccents[color];
                  return <label key={color} title={label} style={{ "--swatch": swatch } as CSSProperties}>
                    <input type="radio" name="npc-accent" value={color} checked={color === accent} aria-label={label}
                      onChange={() => setAccent(color)} />
                    <span aria-hidden="true" />
                  </label>;
                })}
              </div>
            </fieldset>
            <div className="npc-edit-photo">
              {picture && <img src={portraitSrc(picture)} alt="" />}
              <div>
                <label>Retrato
                  <select value={choice} onChange={(e) => setChoice(e.target.value as PhotoChoice)}>
                    <option value="manter">{creating ? "Sem retrato por enquanto" : "Manter retrato atual"}</option>
                    <option value="arquivo">Enviar arquivo do computador</option>
                    <option value="link">Importar imagem de link</option>
                    {originalPicture && <option value="original">Usar retrato original</option>}
                  </select>
                </label>
                {choice === "arquivo" && <label>Arquivo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" required onChange={(e) => setFile(e.target.files?.[0])} /></label>}
                {choice === "link" && <label>Link direto da imagem<input type="url" value={link} placeholder="https://…" required onChange={(e) => setLink(e.target.value)} /></label>}
                {(choice === "link" || choice === "arquivo") && <>
                  <label>Qualidade do envio
                    <select value={compress ? "comprimir" : "original"} onChange={(event) => setCompress(event.target.value === "comprimir")}>
                      <option value="comprimir">Comprimir automaticamente</option>
                      <option value="original">Enviar original</option>
                    </select>
                  </label>
                  <small>{compress
                    ? "Imagem de até 24 MB. Tenta reduzir para até 960 px. As animações ficam no formato original."
                    : "JPG, PNG, WebP ou GIF. Original de até 8 MB."}</small>
                </>}
              </div>
            </div>
            <div className="npc-fields-title">
              <h3>Campos da ficha</h3>
              <button type="button" className="secondary" disabled={fieldCount >= 32} onClick={() => {
                setFields([...fields, { key: nextKey, label: "", value: "" }]);
                setNextKey(nextKey + 1);
              }}>Adicionar campo</button>
            </div>
            <div className="npc-edit-fields">
              {fields.map(({ key, label, value }, index) => (
                <div className="npc-edit-row" key={key}>
                  <input aria-label={`Nome do campo ${index + 1}`} placeholder="Nome do campo" required maxLength={80}
                    value={label} onChange={(e) => changeField(key, "label", e.target.value)} />
                  <textarea aria-label={`Valor do campo ${index + 1}`} placeholder="Valor" rows={1} maxLength={1000}
                    value={value} onChange={(e) => changeField(key, "value", e.target.value)} />
                  <div className="npc-field-actions">
                    <button type="button" disabled={index === 0} aria-label={`Subir ${label || "campo"}`} onClick={() => moveField(index, -1)}>↑</button>
                    <button type="button" disabled={index === fields.length - 1} aria-label={`Descer ${label || "campo"}`} onClick={() => moveField(index, 1)}>↓</button>
                    <button type="button" aria-label={`Remover ${label || "campo"}`} onClick={() => setFields(fields.filter((row) => row.key !== key))}>×</button>
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        </div>
        <footer>
          {error && <ErrorState text={error} />}
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "Salvando…" : creating ? "Adicionar personagem" : "Salvar ficha"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
