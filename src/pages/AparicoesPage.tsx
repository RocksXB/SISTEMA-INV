import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, CircleMinus, Folder, FolderPlus, LayoutGrid, LockKeyhole, Search, Sparkles, UserPlus } from "lucide-react";
import { NpcGmNotes } from "../features/aparicoes/NpcGmNotes";
import { useSearchParams } from "react-router-dom";
import { Empty, ErrorState, Loading, Modal, Panel } from "../components/Ui";
import { CatalogOrder } from "../components/CatalogOrder";
import { compareCatalogEntries, type CatalogSort } from "../utils/catalogSort";
import { npcAccents } from "../config/npcAccents";
import { useAuth } from "../features/auth/AuthContext";
import { NpcEditor } from "../features/aparicoes/NpcEditor";
import { isDivineTopic, npcCardStatus } from "../features/aparicoes/npcStatus";
import { parseCampaignDate } from "../features/calendar/campaignDates";
import { birthdayLabel, isAgeField, isBirthdayField, npcAgeLabel, npcBirthday } from "../features/calendar/npcBirthdays";
import { useCampaignDate } from "../features/calendar/useCampaignDate";
import {
  createNpcTopic, loadNpcs, newNpcId, normalizeNpcText, portraitSrc, refreshPortraitSession,
  type LoadedNpcs, type Npc, type NpcField, type NpcTopic,
} from "../services/aparicoesService";
import "../features/aparicoes/aparicoes.css";

const pageSize = 24;
const summaryFields = new Set(["idade", "altura", "organizacao", "aniversario", "data de nascimento"]);
const normalize = normalizeNpcText;

function Facts({ fields, detail = false }: { fields: NpcField[]; detail?: boolean }) {
  if (!fields.length) return null;
  return (
    <dl className={detail ? "npc-details-fields" : "npc-summary"}>
      {fields.map(([label, value], index) => (
        <div key={index} data-field={normalize(label)}>
          <dt>{label}</dt><dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function NpcCard({ npc, topic, campaignDate, onEdit, onNotes }: { npc: Npc; topic: string; campaignDate: string; onEdit?: () => void; onNotes?: () => void }) {
  const [imageFailed, setImageFailed] = useState(false);
  const status = npcCardStatus(npc.fields, topic);
  const date = parseCampaignDate(campaignDate);
  const age = date && npcAgeLabel(npc, date);
  const birth = npcBirthday(npc.fields);
  let hasAge = false;
  const fields: NpcField[] = npc.fields.map(([label, value]) => {
    if (age && !hasAge && isAgeField(label)) {
      hasAge = true;
      return [label, age];
    }
    return [label, value];
  });
  if (age && !hasAge) fields.push(["Idade", age]);
  if (birth && !fields.some(([label, value]) => isBirthdayField(label) && value.trim())) {
    fields.push(["Aniversário", birthdayLabel(birth)]);
  }
  const [role, type] = ["funcao", "tipo"].map((key) =>
    fields.find(([label, value]) => normalize(label) === key && value));
  const other = fields.filter((field) => field !== role && field !== type && field[1]);
  const summary = other.filter(([label]) => summaryFields.has(normalize(label)));
  const details = other.filter(([label]) => !summaryFields.has(normalize(label)));
  return (
    <article className="npc-card" data-status={status}
      style={{ "--npc-accent": npcAccents[npc.accent || "cyan"][1] } as CSSProperties}>
      <header className="npc-card-head">
        <div className="npc-portrait">
          <span aria-hidden="true">{npc.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase()}</span>
          {npc.image && !imageFailed && <img src={portraitSrc(npc.image)} alt="" loading="lazy" onError={() => setImageFailed(true)} />}
        </div>
        <div>
          <p className="npc-topic">{topic}</p>
          <h3>{npc.name}</h3>
          {status === "morto" && <span className="npc-status"><CircleMinus aria-hidden="true" /> Morto</span>}
          {status === "divindade" && <span className="npc-status"><Sparkles aria-hidden="true" /> Divindade</span>}
          {role && <p className="npc-role">{role[1].replace(/^Agente:\s*$/i, "Agente")}</p>}
          {type && <p className="npc-type">{type[1]}</p>}
        </div>
      </header>
      <Facts fields={summary} />
      {details.length > 0 && <details><summary>Mais informações</summary><Facts fields={details} detail /></details>}
      {(onEdit || onNotes) && <footer>
        {onEdit && <button type="button" aria-label={`Editar ficha de ${npc.name}`} onClick={onEdit}>Editar ficha</button>}
        {onNotes && <button type="button" aria-label={`Anotações do GM sobre ${npc.name}`} onClick={onNotes}>
          <LockKeyhole aria-hidden="true" /> Notas do GM
        </button>}
      </footer>}
    </article>
  );
}

function NewTopic({ topics, onClose, onSave }: {
  topics: NpcTopic[];
  onClose: () => void;
  onSave: (topic: NpcTopic) => void;
}) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      onSave(await createNpcTopic(title, topics));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar o tópico.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Novo tópico" className="npc-topic-editor" onClose={() => { if (!busy) onClose(); }}>
      <form onSubmit={save}>
        <label>Nome do tópico
          <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={60} disabled={busy} />
        </label>
        {error && <ErrorState text={error} />}
        <button type="submit" className="primary" disabled={busy}>{busy ? "Criando…" : "Criar tópico"}</button>
      </form>
    </Modal>
  );
}

export default function AparicoesPage() {
  const { user, profile } = useAuth();
  const { date: campaignDate } = useCampaignDate();
  const [parameters, setParameters] = useSearchParams();
  const linkedNpc = parameters.get("personagem");
  const [catalog, setCatalog] = useState<LoadedNpcs>();
  const [error, setError] = useState("");
  const [topic, setTopic] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [order, setOrder] = useState<CatalogSort>("name");
  const [editing, setEditing] = useState<{ npc: Npc; creating: boolean }>();
  const [notesNpc, setNotesNpc] = useState<Npc>();
  const [addingTopic, setAddingTopic] = useState(false);
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    loadNpcs(user, controller.signal).then((loaded) => {
      if (!controller.signal.aborted) setCatalog(loaded);
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause.message);
    });
    let checked = Date.now();
    const refresh = () => {
      if (document.hidden || Date.now() - checked < 20 * 60_000) return;
      refreshPortraitSession(user).then(() => { checked = Date.now(); }).catch(() => {});
    };
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [user, retry]);

  const topics = useMemo(() => new Map(catalog?.topics.map(({ id, title }) => [id, title])), [catalog]);
  const topicCounts = useMemo(() => {
    const totals = new Map<string, number>();
    for (const npc of catalog?.records || []) totals.set(npc.topicId, (totals.get(npc.topicId) || 0) + 1);
    return totals;
  }, [catalog]);
  const indexed = useMemo(() => catalog?.records.map((npc) => ({
    npc,
    text: normalize([npc.name, topics.get(npc.topicId), ...npc.fields.flat()].join(" ")),
  })) || [], [catalog, topics]);
  const words = normalize(search).trim().split(/\s+/).filter(Boolean);
  const matches = indexed.filter(({ npc, text }) =>
    (!linkedNpc || npc.id === linkedNpc) && (!topic || npc.topicId === topic) && words.every((word) => text.includes(word)))
    .sort((a, b) => compareCatalogEntries(order, a.npc, b.npc));

  if (!catalog && !error) return <Loading label="Carregando personagens…" />;
  const pageCount = Math.ceil(matches.length / pageSize);
  const current = Math.min(page, Math.max(0, pageCount - 1));
  const isAdmin = profile?.role === "admin";
  const canEdit = isAdmin && catalog?.editsAvailable;
  const canCreateTopic = isAdmin && catalog?.topicsAvailable;
  const clearLinkedNpc = () => {
    if (linkedNpc) setParameters((old) => { old.delete("personagem"); return old; }, { replace: true });
  };
  const chooseTopic = (id: string) => { clearLinkedNpc(); setTopic(id); setPage(0); };
  function startNpc() {
    setNotice("");
    setEditing({
      creating: true,
      npc: { id: newNpcId(), topicId: topic, name: "", fields: [
        ["Função", ""], ["Tipo", ""], ["Idade", ""], ["Altura", ""], ["Organização", ""],
      ] },
    });
  }
  return (
    <main className="page npc-page">
      <header className="page-heading npc-page-header">
        <div><h1>Personagens</h1><p>Fichas dos NPCs de Aparições</p></div>
        {canEdit && <button type="button" className="primary npc-create" onClick={startNpc}><UserPlus aria-hidden="true" /> Novo personagem</button>}
      </header>
      {notice && <p className="npc-notice" role="status">{notice}</p>}
      {(error || catalog?.editsAvailable === false || catalog?.topicsAvailable === false) && (
        <div className="npc-retry">
          <ErrorState text={error || (catalog?.editsAvailable === false
            ? "As edições estão indisponíveis. Exibindo as fichas originais."
            : "Os tópicos personalizados estão temporariamente indisponíveis.")} />
          <button type="button" className="secondary" onClick={() => { setError(""); setRetry((old) => old + 1); }}>Tentar de novo</button>
        </div>
      )}
      {catalog && (
        <div className="npc-catalogue">
        <aside className="panel npc-topics" aria-labelledby="npc-topics-title">
          <h2 className="panel-title" id="npc-topics-title"><span aria-hidden="true" /> Tópicos</h2>
          <nav className="npc-topic-list" aria-label="Tópicos de Aparições">
            {[{ id: "", title: "Todos os tópicos" }, ...catalog.topics].map(({ id, title }) => {
              const divine = isDivineTopic(title);
              const Icon = divine ? Sparkles : id ? Folder : LayoutGrid;
              return <button key={id} type="button" aria-pressed={topic === id}
                data-divine={divine || undefined} onClick={() => chooseTopic(id)}>
                <Icon aria-hidden="true" /><span>{title}</span>
                <small>{id ? topicCounts.get(id) || 0 : catalog.records.length}</small>
              </button>;
            })}
          </nav>
          {canCreateTopic && <button type="button" className="npc-new-topic" onClick={() => { setNotice(""); setAddingTopic(true); }}><FolderPlus aria-hidden="true" /> Novo tópico</button>}
        </aside>
        <Panel className="npc-results" title={topics.get(topic) || "Todos os tópicos"}>
          <div className="filters npc-filters">
            <label className="search">
              <Search aria-hidden="true" />
              <input type="search" aria-label="Buscar fichas" placeholder="Buscar por nome, tipo ou organização" value={search}
                onChange={(e) => { clearLinkedNpc(); setSearch(e.target.value); setPage(0); }} />
            </label>
            <select className="npc-mobile-topics" aria-label="Tópico" value={topic} onChange={(e) => chooseTopic(e.target.value)}>
              <option value="">Todos os tópicos</option>
              {catalog.topics.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
            </select>
            <CatalogOrder value={order} onChange={(value) => { setOrder(value); setPage(0); }} />
            {linkedNpc && <button type="button" className="secondary" onClick={clearLinkedNpc}>Ver todas as fichas</button>}
            {canCreateTopic && <button type="button" className="secondary npc-mobile-topics" onClick={() => { setNotice(""); setAddingTopic(true); }}>Novo tópico</button>}
            <span role="status">{matches.length} {matches.length === 1 ? "ficha" : "fichas"}</span>
          </div>
          {!matches.length ? <Empty text="Nenhuma ficha encontrada." /> : (
            <div className="npc-grid">
              {matches.slice(current * pageSize, (current + 1) * pageSize).map(({ npc }) => (
                <NpcCard key={`${npc.id}:${npc.image}`} npc={npc} topic={topics.get(npc.topicId) || ""} campaignDate={campaignDate}
                  onEdit={canEdit ? () => setEditing({ npc, creating: false }) : undefined}
                  onNotes={isAdmin ? () => setNotesNpc(npc) : undefined} />
              ))}
            </div>
          )}
          {pageCount > 1 && (
            <nav className="npc-pagination" aria-label="Páginas do catálogo">
              <button type="button" className="secondary" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Página anterior"><ChevronLeft /></button>
              <span>Página {current + 1} de {pageCount}</span>
              <button type="button" className="secondary" disabled={current + 1 === pageCount} onClick={() => setPage(current + 1)} aria-label="Próxima página"><ChevronRight /></button>
            </nav>
          )}
        </Panel>
        </div>
      )}
      {notesNpc && isAdmin && <NpcGmNotes key={notesNpc.id} npc={notesNpc} onClose={() => setNotesNpc(undefined)}
        onSaved={() => { setNotesNpc(undefined); setNotice("Anotação privada salva."); }} />}
      {addingTopic && canCreateTopic && catalog && (
        <NewTopic topics={catalog.topics} onClose={() => setAddingTopic(false)} onSave={(created) => {
          setCatalog((previous) => previous && ({ ...previous, topics: [...previous.topics, created] }));
          setAddingTopic(false);
          setSearch("");
          chooseTopic(created.id);
          setNotice("Tópico criado.");
        }} />
      )}
      {editing && canEdit && user && catalog && (
        <NpcEditor npc={editing.npc} creating={editing.creating} topics={catalog.topics} user={user}
          campaignDate={campaignDate} onClose={() => setEditing(undefined)} onSave={(updated) => {
          setCatalog((previous) => previous && ({
            ...previous, records: editing.creating
              ? [updated, ...previous.records]
              : previous.records.map((entry) => entry.id === updated.id ? updated : entry),
          }));
          if (editing.creating) {
            setSearch("");
            chooseTopic(updated.topicId);
            setNotice("Personagem adicionado.");
          }
          setEditing(undefined);
        }} />
      )}
    </main>
  );
}
