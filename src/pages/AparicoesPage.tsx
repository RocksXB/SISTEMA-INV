import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Empty, ErrorState, Loading, Panel } from "../components/Ui";
import { useAuth } from "../features/auth/AuthContext";
import { NpcEditor } from "../features/aparicoes/NpcEditor";
import {
  loadNpcs, portraitSrc, refreshPortraitSession, type Npc, type NpcCatalog, type NpcField,
} from "../services/aparicoesService";
import "../features/aparicoes/aparicoes.css";

const pageSize = 24;
const summaryFields = new Set(["idade", "altura", "organizacao"]);
const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

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

function NpcCard({ npc, topic, onEdit }: { npc: Npc; topic: string; onEdit?: () => void }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [role, type] = ["funcao", "tipo"].map((key) =>
    npc.fields.find(([label, value]) => normalize(label) === key && value));
  const other = npc.fields.filter((field) => field !== role && field !== type && field[1]);
  const summary = other.filter(([label]) => summaryFields.has(normalize(label)));
  const details = other.filter(([label]) => !summaryFields.has(normalize(label)));
  return (
    <article className="npc-card" data-accent={npc.accent || "cyan"}>
      <header className="npc-card-head">
        <div className="npc-portrait">
          <span aria-hidden="true">{npc.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase()}</span>
          {npc.image && !imageFailed && <img src={portraitSrc(npc.image)} alt="" loading="lazy" onError={() => setImageFailed(true)} />}
        </div>
        <div>
          <p className="npc-topic">{topic}</p>
          <h3>{npc.name}</h3>
          {role && <p className="npc-role">{role[1].replace(/^Agente:\s*$/i, "Agente")}</p>}
          {type && <p className="npc-type">{type[1]}</p>}
        </div>
      </header>
      <Facts fields={summary} />
      {details.length > 0 && <details><summary>Mais informações</summary><Facts fields={details} detail /></details>}
      {onEdit && <footer><button type="button" aria-label={`Editar ficha de ${npc.name}`} onClick={onEdit}>Editar ficha</button></footer>}
    </article>
  );
}

export default function AparicoesPage() {
  const { user, profile } = useAuth();
  const [catalog, setCatalog] = useState<NpcCatalog & { editsAvailable: boolean }>();
  const [error, setError] = useState("");
  const [topic, setTopic] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Npc>();
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
  const indexed = useMemo(() => catalog?.records.map((npc) => ({
    npc,
    text: normalize([npc.name, topics.get(npc.topicId), ...npc.fields.flat()].join(" ")),
  })) || [], [catalog, topics]);
  const words = normalize(search).trim().split(/\s+/).filter(Boolean);
  const matches = indexed.filter(({ npc, text }) =>
    (!topic || npc.topicId === topic) && words.every((word) => text.includes(word)));

  if (!catalog && !error) return <Loading label="Carregando personagens…" />;
  const pageCount = Math.ceil(matches.length / pageSize);
  const current = Math.min(page, Math.max(0, pageCount - 1));
  const isAdmin = profile?.role === "admin";
  return (
    <main className="page npc-page">
      <div className="page-heading">
        <h1>Personagens</h1>
        <p>Fichas dos NPCs de Aparições</p>
      </div>
      {(error || catalog?.editsAvailable === false) && (
        <div className="npc-retry">
          <ErrorState text={error || "As edições estão indisponíveis. Exibindo as fichas originais."} />
          <button type="button" className="secondary" onClick={() => { setError(""); setRetry((old) => old + 1); }}>Tentar de novo</button>
        </div>
      )}
      {catalog && (
        <Panel className="npc-results" title={topics.get(topic) || "Todos os tópicos"}>
          <div className="filters npc-filters">
            <label className="search">
              <Search aria-hidden="true" />
              <input type="search" aria-label="Buscar fichas" placeholder="Buscar por nome, tipo ou organização" value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
            </label>
            <select aria-label="Tópico" value={topic} onChange={(e) => { setTopic(e.target.value); setPage(0); }}>
              <option value="">Todos os tópicos</option>
              {catalog.topics.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
            </select>
            <span role="status">{matches.length} {matches.length === 1 ? "ficha" : "fichas"}</span>
          </div>
          {!matches.length ? <Empty text="Nenhuma ficha encontrada." /> : (
            <div className="npc-grid">
              {matches.slice(current * pageSize, (current + 1) * pageSize).map(({ npc }) => (
                <NpcCard key={`${npc.id}:${npc.image}`} npc={npc} topic={topics.get(npc.topicId) || ""}
                  onEdit={isAdmin && catalog.editsAvailable ? () => setEditing(npc) : undefined} />
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
      )}
      {editing && isAdmin && user && (
        <NpcEditor npc={editing} user={user} onClose={() => setEditing(undefined)} onSave={(updated) => {
          setCatalog((previous) => previous && ({
            ...previous, records: previous.records.map((entry) => entry.id === updated.id ? updated : entry),
          }));
          setEditing(undefined);
        }} />
      )}
    </main>
  );
}
