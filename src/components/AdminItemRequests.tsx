import { Check, ClipboardList, Link2, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import {
  approveItemRequest,
  deleteItemRequest,
  rejectItemRequest,
  updatePendingRequest,
} from "../services/itemRequestService";
import type {
  Character,
  ItemDefinition,
  ItemRequest,
  ItemRequestDraft,
} from "../types";
import { ItemRequestForm } from "./ItemRequestForm";
import { Empty, ErrorState, Modal } from "./Ui";

const toDraft = (request: ItemRequest): ItemRequestDraft => ({
  name: request.name,
  description: request.description,
  category: request.category,
  weight: request.weight,
  imageUrl: request.imageUrl ?? "",
  rarity: request.rarity,
  stackable: request.stackable,
  maxStack: request.maxStack,
  equippable: request.equippable,
  allowedEquipmentSlots: request.allowedEquipmentSlots,
  tags: request.tags,
  quantity: request.quantity,
});

export function AdminItemRequests({
  items,
  characters,
  requests,
  loading,
  error,
}: {
  items: ItemDefinition[];
  characters: Character[];
  requests: ItemRequest[];
  loading: boolean;
  error: string;
}) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<ItemRequest | null>(null);
  const [actionError, setActionError] = useState("");
  const pending = requests.filter((request) => request.status === "pending");
  if (error || actionError) return <ErrorState text={error || actionError} />;
  if (loading)
    return <div className="request-loading">SINCRONIZANDO SOLICITAÇÕES...</div>;
  if (!requests.length) return <Empty text="NENHUMA SOLICITAÇÃO RECEBIDA" />;
  return (
    <>
      <div className="request-admin-list">
        {requests.map((request) => {
          const character = characters.find(
            (entry) => entry.id === request.characterId,
          );
          return (
            <button key={request.id} onClick={() => setSelected(request)}>
              <ClipboardList />
              <div>
                <b>{request.name}</b>
                <span>
                  {character?.name ?? "PERSONAGEM INDISPONÍVEL"} // ×
                  {request.quantity} // {request.requestedBy}
                </span>
              </div>
              <em className={`request-status status-${request.status}`}>
                {request.status === "pending"
                  ? "PENDENTE"
                  : request.status === "approved"
                    ? "APROVADO"
                    : "REJEITADO"}
              </em>
            </button>
          );
        })}
      </div>
      {selected && user && (
        <RequestReview
          key={`${selected.id}-${selected.updatedAt?.toMillis() ?? 0}`}
          request={selected}
          items={items}
          character={characters.find(
            (entry) => entry.id === selected.characterId,
          )}
          adminUid={user.uid}
          onClose={() => setSelected(null)}
          onError={setActionError}
        />
      )}
      <span className="sr-only">{pending.length} solicitações pendentes</span>
    </>
  );
}

function RequestReview({
  request,
  items,
  character,
  adminUid,
  onClose,
  onError,
}: {
  request: ItemRequest;
  items: ItemDefinition[];
  character?: Character;
  adminUid: string;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState(toDraft(request));
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [existingId, setExistingId] = useState(items[0]?.id ?? "");
  const [adminNote, setAdminNote] = useState(request.adminNote ?? "");
  const [busy, setBusy] = useState(false);
  const characterLabel = useMemo(
    () => character?.name ?? request.characterId,
    [character, request.characterId],
  );
  async function save(changes: ItemRequestDraft) {
    await updatePendingRequest(request.id, changes);
    setDraft(changes);
  }
  async function approve() {
    if (!character) return onError("O personagem solicitado não existe mais.");
    if (mode === "existing" && !existingId)
      return onError("Selecione um item existente.");
    setBusy(true);
    try {
      await approveItemRequest(
        request.id,
        adminUid,
        mode === "existing"
          ? { existingItemId: existingId }
          : { create: draft },
      );
      onClose();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "A aprovação falhou.");
      setBusy(false);
    }
  }
  async function reject() {
    setBusy(true);
    try {
      await rejectItemRequest(request.id, adminUid, adminNote);
      onClose();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "A rejeição falhou.");
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirm(`Excluir permanentemente a solicitação de ${request.name}?`))
      return;
    try {
      await deleteItemRequest(request.id);
      onClose();
    } catch {
      onError("Não foi possível excluir a solicitação.");
    }
  }
  return (
    <Modal title={`Solicitação // ${request.name}`} onClose={onClose}>
      <div className="request-meta">
        {request.imageUrl && <img src={request.imageUrl} alt="" />}
        <dl>
          <div>
            <dt>Jogador</dt>
            <dd>{request.requestedBy}</dd>
          </div>
          <div>
            <dt>Personagem</dt>
            <dd>{characterLabel}</dd>
          </div>
          <div>
            <dt>Enviado em</dt>
            <dd>
              {request.createdAt?.toDate().toLocaleString("pt-BR") ?? "Agora"}
            </dd>
          </div>
        </dl>
      </div>
      {request.status === "pending" ? (
        <>
          <ItemRequestForm
            initial={draft}
            submitLabel="SALVAR ALTERAÇÕES"
            onSubmit={save}
          />
          <div className="approval-mode">
            <button
              className={mode === "new" ? "active" : ""}
              onClick={() => setMode("new")}
            >
              <Plus /> CRIAR NOVO ITEM NO CATÁLOGO
            </button>
            <button
              className={mode === "existing" ? "active" : ""}
              onClick={() => setMode("existing")}
            >
              <Link2 /> VINCULAR A ITEM EXISTENTE
            </button>
          </div>
          {mode === "existing" && (
            <label className="request-existing">
              Item do catálogo
              <select
                value={existingId}
                onChange={(event) => setExistingId(event.target.value)}
              >
                <option value="">Selecione</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="request-note">
            Observação do GM (usada ao rejeitar)
            <textarea
              value={adminNote}
              onChange={(event) => setAdminNote(event.target.value)}
            />
          </label>
          <div className="review-actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() => void approve()}
            >
              <Check /> APROVAR
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={() => void reject()}
            >
              <X /> REJEITAR
            </button>
            <button disabled={busy} onClick={() => void remove()}>
              <Trash2 /> EXCLUIR
            </button>
          </div>
        </>
      ) : (
        <div className="reviewed-request">
          <b>SOLICITAÇÃO {request.status.toUpperCase()}</b>
          <span>{request.adminNote || "Sem observação do GM."}</span>
          <button className="danger" onClick={() => void remove()}>
            <Trash2 /> EXCLUIR REGISTRO
          </button>
        </div>
      )}
    </Modal>
  );
}
