import { ClipboardList, Send, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  cancelItemRequest,
  createItemRequest,
  subscribeMyItemRequests,
} from "../services/itemRequestService";
import type { ItemRequest, ItemRequestDraft } from "../types";
import { ItemRequestForm } from "./ItemRequestForm";
import { Modal, Empty, ErrorState, Panel } from "./Ui";

const statusLabels = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
};

export function PlayerItemRequests({
  characterId,
  uid,
  onSuccess,
}: {
  characterId: string;
  uid: string;
  onSuccess: (message: string) => void;
}) {
  const [requests, setRequests] = useState<ItemRequest[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(
    () =>
      subscribeMyItemRequests(
        uid,
        (values) => {
          setRequests(
            values.filter((entry) => entry.characterId === characterId),
          );
          setLoading(false);
        },
        () => {
          setError("Não foi possível sincronizar suas solicitações.");
          setLoading(false);
        },
      ),
    [characterId, uid],
  );
  async function submit(draft: ItemRequestDraft) {
    await createItemRequest(characterId, draft);
    setOpen(false);
    onSuccess("SOLICITAÇÃO ENVIADA AO GM");
  }
  async function cancel(request: ItemRequest) {
    if (!confirm(`Cancelar a solicitação de ${request.name}?`)) return;
    try {
      await cancelItemRequest(request);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao cancelar.");
    }
  }
  return (
    <Panel title="Minhas solicitações" className="request-panel">
      <button className="request-cta" onClick={() => setOpen(true)}>
        <Send /> ENVIAR ITEM PARA APROVAÇÃO
      </button>
      {error && <ErrorState text={error} />}
      {loading ? (
        <div className="request-loading">SINCRONIZANDO SOLICITAÇÕES...</div>
      ) : requests.length ? (
        <div className="request-list">
          {requests.map((request) => (
            <article key={request.id}>
              <ClipboardList />
              <div>
                <b>{request.name}</b>
                <span>
                  ×{request.quantity} //{" "}
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
        <Empty text="NENHUMA SOLICITAÇÃO REGISTRADA" />
      )}
      {open && (
        <Modal title="Solicitar item ao GM" onClose={() => setOpen(false)}>
          <ItemRequestForm submitLabel="ENVIAR SOLICITAÇÃO" onSubmit={submit} />
        </Modal>
      )}
    </Panel>
  );
}
