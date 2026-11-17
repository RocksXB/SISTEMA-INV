import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ChevronRight, Pencil, Plus, Search, ShieldHalf, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Empty, ErrorState, Modal, Panel } from "../components/Ui";
import { useAuth } from "../features/auth/AuthContext";
import { loadNpcs, normalizeNpcText, type LoadedNpcs } from "../services/aparicoesService";
import { deleteSquad, loadSquads, maxSquadName, saveSquad, type Squad } from "../services/squadService";
import "./squads.css";

const memberCount = (count: number) => `${count} ${count === 1 ? "integrante" : "integrantes"}`;
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "pt-BR");

export default function SquadsPage() {
  const { profile, user } = useAuth();
  const isGM = profile?.role === "admin";
  const [squads, setSquads] = useState<Squad[]>();
  const [listError, setListError] = useState("");
  const [catalog, setCatalog] = useState<LoadedNpcs>();
  const [catalogError, setCatalogError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [editor, setEditor] = useState<{ name: string; memberIds: string[]; previous?: Squad }>();
  const [removing, setRemoving] = useState<Squad>();
  const [query, setQuery] = useState("");
  const [onlyMembers, setOnlyMembers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const needsCatalog = Boolean(squads?.some((squad) => squad.memberIds.length) || editor);

  useEffect(() => {
    if (!user) return;
    let active = true;
    loadSquads().then((result) => {
      if (active) setSquads(result.sort(byName));
    }).catch(() => {
      if (active) setListError("Não foi possível carregar os esquadrões.");
    });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!user || !needsCatalog || catalog) return;
    const controller = new AbortController();
    loadNpcs(user, controller.signal).then((result) => {
      if (!controller.signal.aborted) {
        setCatalogError("");
        setCatalog(result);
      }
    }).catch(() => {
      if (!controller.signal.aborted) setCatalogError("Não foi possível carregar as fichas de Aparições.");
    });
    return () => controller.abort();
  }, [user, needsCatalog, catalog]);

  const selected = squads?.find((squad) => squad.id === selectedId) ?? squads?.[0];
  const topics = useMemo(() => new Map(catalog?.topics.map(({ id, title }) => [id, title])), [catalog]);
  const characters = useMemo(() => [...(catalog?.records ?? [])].sort(byName), [catalog]);
  const linkedIds = new Set(selected?.memberIds);
  const members = characters.filter((character) => linkedIds.has(character.id));
  const unavailable = (selected?.memberIds.length ?? 0) - members.length;
  const chosen = new Set(editor?.memberIds);
  const search = normalizeNpcText(query.trim());
  const options = editor ? characters.filter((character) =>
    (!onlyMembers || chosen.has(character.id)) &&
    normalizeNpcText(`${character.name} ${topics.get(character.topicId) ?? ""}`).includes(search),
  ) : [];

  function openEditor(previous?: Squad) {
    setQuery("");
    setOnlyMembers(false);
    setSaveError("");
    setEditor({ previous, name: previous?.name ?? "", memberIds: previous?.memberIds ?? [] });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || saving || !catalog?.editsAvailable) return;
    setSaving(true);
    setSaveError("");
    try {
      const saved = await saveSquad(editor, editor.previous);
      setSquads((current) => [...(current ?? []).filter((squad) => squad.id !== saved.id), saved].sort(byName));
      setSelectedId(saved.id);
      setNotice(`Esquadrão ${saved.name} salvo.`);
      setEditor(undefined);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Não foi possível salvar o esquadrão.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!removing || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      await deleteSquad(removing);
      setSquads((current) => current?.filter((squad) => squad.id !== removing.id));
      setSelectedId("");
      setNotice(`Esquadrão ${removing.name} excluído.`);
      setRemoving(undefined);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Não foi possível excluir o esquadrão.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page squads-page">
      <header className="page-heading squad-heading">
        <div>
          <h1>Esquadrões</h1>
          <p>Equipes e integrantes de Aparições</p>
        </div>
        {isGM && squads && <button type="button" className="primary" onClick={() => openEditor()}><Plus /> Novo esquadrão</button>}
      </header>
      {notice && <p className="form-success" role="status">{notice}</p>}
      {listError && <ErrorState text={listError} />}
      {!squads && !listError && <p role="status">Carregando esquadrões…</p>}
      {squads?.length === 0 && <Panel><Empty text="Nenhum esquadrão cadastrado." /></Panel>}
      {selected && (
        <div className="squad-layout">
          <aside className="panel squad-sidebar" aria-label="Lista de esquadrões">
            <ul>{squads?.map((squad) => (
              <li key={squad.id}>
                <button type="button" aria-pressed={squad.id === selected.id} onClick={() => setSelectedId(squad.id)}>
                  <ShieldHalf aria-hidden="true" />
                  <span><b>{squad.name}</b><small>{memberCount(squad.memberIds.length)}</small></span>
                  <ChevronRight aria-hidden="true" />
                </button>
              </li>
            ))}</ul>
          </aside>
          <Panel className="squad-roster">
            <header>
              <div><h2>{selected.name}</h2><p>{memberCount(selected.memberIds.length)}</p></div>
              {isGM && <div className="squad-actions">
                <button type="button" className="secondary" onClick={() => openEditor(selected)}><Pencil /> Editar</button>
                <button type="button" className="secondary" aria-label="Excluir esquadrão" onClick={() => { setSaveError(""); setRemoving(selected); }}><Trash2 /></button>
              </div>}
            </header>
            {!selected.memberIds.length && <Empty text="Nenhum integrante neste esquadrão." />}
            {selected.memberIds.length > 0 && catalogError && <ErrorState text={catalogError} />}
            {selected.memberIds.length > 0 && !catalog && !catalogError && <p role="status">Carregando integrantes…</p>}
            {members.length > 0 && <ul>{members.map((character) => (
              <li key={character.id}>
                <Link to={`/aparicoes?personagem=${encodeURIComponent(character.id)}`}>
                  <span><b>{character.name}</b><small>{topics.get(character.topicId)}</small></span>
                  <ChevronRight aria-hidden="true" />
                </Link>
              </li>
            ))}</ul>}
            {catalog && unavailable > 0 && <p className="squad-catalog-note">{unavailable === 1 ? "1 ficha indisponível." : `${unavailable} fichas indisponíveis.`}</p>}
          </Panel>
        </div>
      )}
      {isGM && editor && (
        <Modal title={editor.previous ? "Editar esquadrão" : "Novo esquadrão"} onClose={() => { if (!saving) setEditor(undefined); }} className="squad-modal">
          <form className="squad-form" onSubmit={submit}>
            <fieldset disabled={saving}>
              <label htmlFor="squad-name">Nome do esquadrão</label>
              <input id="squad-name" maxLength={maxSquadName} required value={editor.name}
                onChange={(event) => setEditor({ ...editor, name: event.target.value })} />
              <div className="squad-picker-heading">
                <label htmlFor="squad-search">Integrantes</label>
                <span aria-live="polite">{memberCount(chosen.size)}</span>
              </div>
              <div className="squad-search">
                <Search aria-hidden="true" />
                <input id="squad-search" type="search" placeholder="Buscar por personagem ou tópico" value={query}
                  onChange={(event) => setQuery(event.target.value)} />
              </div>
              <label className="squad-option"><input type="checkbox" checked={onlyMembers}
                onChange={(event) => setOnlyMembers(event.target.checked)} /> Mostrar só selecionados</label>
              {catalogError && <ErrorState text={catalogError} />}
              {catalog && !catalog.editsAvailable && <ErrorState text="Não foi possível carregar todas as fichas. Atualize a página para editar." />}
              {!catalog && !catalogError && <p role="status">Carregando fichas…</p>}
              {catalog && !options.length && <p className="squad-catalog-note">Nenhum personagem encontrado.</p>}
              {options.length > 0 && <ul className="squad-options" aria-label="Personagens de Aparições">{options.map((character) => (
                <li key={character.id}>
                  <label className="squad-option">
                    <input type="checkbox" checked={chosen.has(character.id)} onChange={(event) => {
                      const memberIds = event.target.checked ? [...editor.memberIds, character.id] : editor.memberIds.filter((id) => id !== character.id);
                      setEditor({ ...editor, memberIds });
                    }} />
                    <span><b>{character.name}</b><small>{topics.get(character.topicId)}</small></span>
                  </label>
                </li>
              ))}</ul>}
            </fieldset>
            {saveError && <div role="alert"><ErrorState text={saveError} /></div>}
            <div className="squad-actions">
              <button type="button" className="secondary" onClick={() => setEditor(undefined)} disabled={saving}>Cancelar</button>
              <button type="submit" className="primary" disabled={saving || !editor.name.trim() || !catalog?.editsAvailable}>
                {saving ? "Salvando…" : "Salvar esquadrão"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {isGM && removing && (
        <Modal title="Excluir esquadrão" onClose={() => { if (!saving) setRemoving(undefined); }} className="squad-modal">
          <p>Excluir <strong>{removing.name}</strong> e seus vínculos de integrantes?</p>
          {saveError && <div role="alert"><ErrorState text={saveError} /></div>}
          <div className="squad-actions">
            <button type="button" className="secondary" onClick={() => setRemoving(undefined)} disabled={saving}>Cancelar</button>
            <button type="button" className="danger" onClick={() => void remove()} disabled={saving}>{saving ? "Excluindo…" : "Excluir esquadrão"}</button>
          </div>
        </Modal>
      )}
    </main>
  );
}
