import { useEffect, useState, type FormEvent } from "react";
import { LockKeyhole } from "lucide-react";
import { ErrorState, Modal } from "../../components/Ui";
import { loadNpcNote, maxNpcNoteLength, saveNpcNote, type NpcNote } from "../../services/npcNotesService";
import type { Npc } from "../../services/aparicoesService";

export function NpcGmNotes({ npc, onClose, onSaved }: {
  npc: Npc;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [note, setNote] = useState<NpcNote>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    loadNpcNote(npc.id).then((value) => {
      if (active) { setNote(value); setError(""); }
    }).catch(() => {
      if (active) setError("Não foi possível carregar a anotação privada.");
    });
    return () => { active = false; };
  }, [npc.id, retry]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!note || saving) return;
    setSaving(true);
    setError("");
    try {
      await saveNpcNote(npc.id, note);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a anotação.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Anotações do GM" className="npc-notes-modal" onClose={() => { if (!saving) onClose(); }}>
      <p className="npc-notes-private"><LockKeyhole aria-hidden="true" /> Acesso exclusivo do GM</p>
      <h3>{npc.name}</h3>
      {!note && !error && <p role="status">Carregando anotação…</p>}
      {error && <div role="alert"><ErrorState text={error} /></div>}
      <form className="npc-notes-form" onSubmit={save}>
        {note && <label>Anotação privada
          <textarea value={note.text} maxLength={maxNpcNoteLength} rows={12} disabled={saving}
            placeholder="Segredos, planos e informações para conduzir a campanha"
            onChange={(event) => setNote({ ...note, text: event.target.value })} />
        </label>}
        <div className="npc-notes-actions">
          {error && <button type="button" className="secondary" disabled={saving}
            onClick={() => { setNote(undefined); setError(""); setRetry((value) => value + 1); }}>Recarregar anotação</button>}
          <button type="button" className="secondary" disabled={saving} onClick={onClose}>Cancelar</button>
          <button type="submit" className="primary" disabled={!note || saving}>{saving ? "Salvando…" : "Salvar anotação"}</button>
        </div>
      </form>
    </Modal>
  );
}
