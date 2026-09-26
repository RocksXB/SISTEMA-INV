import { Check, ClipboardList, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import {
  approveSkillRequest,
  deleteSkillRequest,
  rejectSkillRequest,
  updatePendingSkillRequest,
} from "../services/skillRequestService";
import type {
  Character,
  SkillRequest,
  SkillRequestDraft,
} from "../types";
import { skillTypeLabel } from "../config/skillTypes";
import { SkillForm } from "./SkillForm";
import { Empty, ErrorState, Modal } from "./Ui";

const toDraft = (request: SkillRequest): SkillRequestDraft => ({
  name: request.name,
  type: request.type,
  description: request.description,
  jetCost: request.jetCost,
  cooldown: request.cooldown,
  duration: request.duration,
  damage: request.damage,
  effect: request.effect,
  conditions: request.conditions,
  imageUrl: request.imageUrl ?? "",
  tags: request.tags,
});

export function AdminSkillRequests({
  characters,
  requests,
  loading,
  error,
}: {
  characters: Character[];
  requests: SkillRequest[];
  loading: boolean;
  error: string;
}) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<SkillRequest | null>(null);
  const [actionError, setActionError] = useState("");

  if (error || actionError) return <ErrorState text={error || actionError} />;
  if (loading)
    return <div className="request-loading">SINCRONIZANDO HABILIDADES...</div>;
  if (!requests.length)
    return <Empty text="NENHUMA SOLICITAÇÃO DE HABILIDADE" />;

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
                  {character?.name ?? "PERSONAGEM INDISPONÍVEL"} //{" "}
                  {skillTypeLabel(request.type)} // {request.jetCost} JET
                </span>
              </div>
              <em className={`request-status status-${request.status}`}>
                {request.status === "pending"
                  ? "PENDENTE"
                  : request.status === "approved"
                    ? "APROVADA"
                    : "REJEITADA"}
              </em>
            </button>
          );
        })}
      </div>
      {selected && user && (
        <SkillRequestReview
          key={`${selected.id}-${selected.updatedAt?.toMillis() ?? 0}`}
          request={selected}
          character={characters.find(
            (entry) => entry.id === selected.characterId,
          )}
          adminUid={user.uid}
          onClose={() => setSelected(null)}
          onError={setActionError}
        />
      )}
    </>
  );
}

function SkillRequestReview({
  request,
  character,
  adminUid,
  onClose,
  onError,
}: {
  request: SkillRequest;
  character?: Character;
  adminUid: string;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState(toDraft(request));
  const [adminNote, setAdminNote] = useState(request.adminNote ?? "");
  const [busy, setBusy] = useState(false);
  const characterLabel = useMemo(
    () => character?.name ?? request.characterId,
    [character, request.characterId],
  );

  async function save(changes: SkillRequestDraft) {
    await updatePendingSkillRequest(request.id, changes);
    setDraft(changes);
  }

  async function approve() {
    if (!character) return onError("O personagem solicitado não existe mais.");
    setBusy(true);
    try {
      await approveSkillRequest(request.id, adminUid, draft);
      onClose();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "A aprovação falhou.");
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    try {
      await rejectSkillRequest(request.id, adminUid, adminNote);
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
      await deleteSkillRequest(request.id);
      onClose();
    } catch {
      onError("Não foi possível excluir a solicitação.");
    }
  }

  return (
    <Modal title={`Habilidade // ${request.name}`} onClose={onClose}>
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
            <dt>Tipo</dt>
            <dd>{skillTypeLabel(request.type)}</dd>
          </div>
        </dl>
      </div>
      {request.status === "pending" ? (
        <>
          <SkillForm
            value={draft}
            onChange={setDraft}
            submitLabel="SALVAR ALTERAÇÕES"
            onSubmit={save}
          />
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
          <b>
            {request.status === "approved"
              ? "HABILIDADE APROVADA"
              : "HABILIDADE REJEITADA"}
          </b>
          {request.adminNote && <p>{request.adminNote}</p>}
          {request.approvedSkillId && (
            <small>ID oficial: {request.approvedSkillId}</small>
          )}
          <button className="danger" onClick={() => void remove()}>
            <Trash2 /> EXCLUIR SOLICITAÇÃO
          </button>
        </div>
      )}
    </Modal>
  );
}
