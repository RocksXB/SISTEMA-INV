import { ClipboardList, Send, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  cancelSkillRequest,
  createSkillRequest,
  subscribeMySkillRequests,
} from "../services/skillRequestService";
import type { SkillRequest, SkillRequestDraft } from "../types";
import { SkillForm } from "./SkillForm";
import { Empty, ErrorState, Modal, Panel } from "./Ui";

const statusLabels = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Rejeitada",
};

export function PlayerSkillRequests({
  characterId,
  uid,
  onSuccess,
}: {
  characterId: string;
  uid: string;
  onSuccess: (message: string) => void;
}) {
  const [requests, setRequests] = useState<SkillRequest[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      subscribeMySkillRequests(
        uid,
        (values) => {
          setRequests(
            values.filter((entry) => entry.characterId === characterId),
          );
          setLoading(false);
        },
        () => {
          setError("Não foi possível sincronizar suas solicitações de habilidades.");
          setLoading(false);
        },
      ),
    [characterId, uid],
  );

  async function submit(draft: SkillRequestDraft) {
    await createSkillRequest(characterId, draft);
    setOpen(false);
    onSuccess("HABILIDADE ENVIADA AO GM");
  }

  async function cancel(request: SkillRequest) {
    if (!confirm(`Cancelar a solicitação de ${request.name}?`)) return;
    try {
      await cancelSkillRequest(request);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao cancelar.");
    }
  }

  return (
    <Panel title="Solicitações de habilidades" className="request-panel skill-request-panel">
      <button className="request-cta" onClick={() => setOpen(true)}>
        <Send /> ENVIAR HABILIDADE PARA APROVAÇÃO
      </button>
      {error && <ErrorState text={error} />}
      {loading ? (
        <div className="request-loading">SINCRONIZANDO HABILIDADES...</div>
      ) : requests.length ? (
        <div className="request-list">
          {requests.map((request) => (
            <article key={request.id}>
              <ClipboardList />
              <div>
                <b>{request.name}</b>
                <span>
                  {request.type} // {request.jetCost} JET //{" "}
                  {request.createdAt?.toDate().toLocaleDateString("pt-BR") ??
                    "AGORA"}
                </span>
                {request.adminNote && <small>GM: {request.adminNote}</small>}
              </div>
              <em className={`request-status status-${request.status}`}>
                {statusLabels[request.status]}
              </em>
              {request.status === "pending" && (
                <button
                  className="danger-icon"
                  aria-label={`Cancelar solicitação de ${request.name}`}
                  onClick={() => void cancel(request)}
                >
                  <Trash2 />
                </button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty text="NENHUMA HABILIDADE PENDENTE" />
      )}
      {open && (
        <Modal title="Solicitar habilidade ao GM" onClose={() => setOpen(false)}>
          <SkillForm submitLabel="ENVIAR SOLICITAÇÃO" onSubmit={submit} />
        </Modal>
      )}
    </Panel>
  );
}
