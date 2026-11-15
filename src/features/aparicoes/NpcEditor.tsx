import { useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import { ErrorState, Modal } from "../../components/Ui";
import {
  fetchNpcImage, maxNpcPortrait, npcAccents, portraitSrc, saveNpc,
  type Npc, type NpcAccent, type NpcField,
} from "../../services/aparicoesService";

const colors = ["Ciano", "Violeta", "Âmbar", "Verde", "Rosa"];
type PhotoChoice = "manter" | "arquivo" | "link" | "original";

export function NpcEditor({ npc, user, onClose, onSave }: {
  npc: Npc;
  user: User;
  onClose: () => void;
  onSave: (npc: Npc) => void;
}) {
  const [name, setName] = useState(npc.name);
  const [accent, setAccent] = useState<NpcAccent>(npc.accent || "cyan");
  const [fields, setFields] = useState(npc.fields.map(([label, value], key) => ({ key, label, value })));
  const [nextKey, setNextKey] = useState(fields.length);
  const [choice, setChoice] = useState<PhotoChoice>("manter");
  const [file, setFile] = useState<File>();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const picture = choice === "original" ? npc.originalImage || npc.image : npc.image;

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
    const trimmed: NpcField[] = fields.map(({ label, value }) => [label.trim(), value.trim()]);
    if (!name.trim() || trimmed.some(([label]) => !label)) {
      setError("Preencha o nome do personagem e de cada campo.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const photo = choice === "link" ? await fetchNpcImage(link) : choice === "arquivo" ? file : undefined;
      if ((choice === "arquivo" || choice === "link") && (!photo?.size || photo.size > maxNpcPortrait)) {
        throw new Error("Selecione uma imagem de até 8 MB.");
      }
      onSave(await saveNpc(user, npc, {
        name: name.trim(), accent, fields: trimmed,
        imageAction: photo ? "trocar" : choice === "original" ? "original" : "manter",
      }, photo));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a ficha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Editar ficha" className="npc-editor" onClose={() => { if (!busy) onClose(); }}>
      <form onSubmit={save}>
        <div className="npc-editor-body">
          <fieldset disabled={busy}>
            <div className="npc-edit-settings">
              <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={150} /></label>
              <label>Cor de destaque
                <select value={accent} onChange={(e) => setAccent(e.target.value as NpcAccent)}>
                  {npcAccents.map((color, index) => <option key={color} value={color}>{colors[index]}</option>)}
                </select>
              </label>
            </div>
            <div className="npc-edit-photo">
              {picture && <img src={portraitSrc(picture)} alt="" />}
              <div>
                <label>Retrato
                  <select value={choice} onChange={(e) => setChoice(e.target.value as PhotoChoice)}>
                    <option value="manter">Manter retrato atual</option>
                    <option value="arquivo">Enviar arquivo do computador</option>
                    <option value="link">Importar imagem de link</option>
                    <option value="original">Usar retrato original</option>
                  </select>
                </label>
                {choice === "arquivo" && <label>Arquivo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" required onChange={(e) => setFile(e.target.files?.[0])} /></label>}
                {choice === "link" && <label>Link direto da imagem<input type="url" value={link} placeholder="https://…" required onChange={(e) => setLink(e.target.value)} /></label>}
                {(choice === "link" || choice === "arquivo") && <small>JPG, PNG, WebP ou GIF, até 8 MB.</small>}
              </div>
            </div>
            <div className="npc-fields-title">
              <h3>Campos da ficha</h3>
              <button type="button" className="secondary" disabled={fields.length >= 32} onClick={() => {
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
          <button type="submit" className="primary" disabled={busy}>{busy ? "Salvando…" : "Salvar ficha"}</button>
        </footer>
      </form>
    </Modal>
  );
}
