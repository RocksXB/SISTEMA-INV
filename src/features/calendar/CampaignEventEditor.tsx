import { useState, type FormEvent } from "react";
import { ErrorState, Modal } from "../../components/Ui";
import {
  maxEventDescription, maxEventTitle, newCampaignEventId, saveCampaignEvent, type CampaignEvent,
} from "../../services/campaignEventsService";

export function CampaignEventEditor({ initialDate, previous, onClose, onSaved }: {
  initialDate: string;
  previous?: CampaignEvent;
  onClose: () => void;
  onSaved: (event: CampaignEvent) => void;
}) {
  const [event, setEvent] = useState<CampaignEvent>(() => previous ?? {
    id: newCampaignEventId(), title: "", description: "", date: initialDate, revision: 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save(submission: FormEvent) {
    submission.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      onSaved(await saveCampaignEvent(event));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o evento.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal title={previous ? "Editar evento" : "Novo evento"} onClose={() => { if (!saving) onClose(); }}>
      <p className="campaign-event-visibility">Visível ao GM e aos jogadores</p>
      <form className="campaign-event-form" onSubmit={save}>
        <label>Título
          <input value={event.title} required maxLength={maxEventTitle} disabled={saving}
            onChange={(change) => setEvent({ ...event, title: change.target.value })} />
        </label>
        <label>Data do evento
          <input type="date" min="0001-01-01" max="9999-12-31" value={event.date} required disabled={saving}
            onChange={(change) => setEvent({ ...event, date: change.target.value })} />
        </label>
        <label>Descrição · opcional
          <textarea value={event.description} maxLength={maxEventDescription} rows={5} disabled={saving}
            onChange={(change) => setEvent({ ...event, description: change.target.value })} />
        </label>
        {error && <div role="alert"><ErrorState text={error} /></div>}
        <div className="campaign-event-actions">
          <button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="primary" disabled={saving || !event.title.trim()}>{saving ? "Salvando…" : "Salvar evento"}</button>
        </div>
      </form>
    </Modal>
  );
}
