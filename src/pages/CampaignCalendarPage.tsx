import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, Cake, ChevronLeft, ChevronRight, Flag, Pencil, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Empty, ErrorState, Modal, Panel } from "../components/Ui";
import { CampaignEventEditor } from "../features/calendar/CampaignEventEditor";
import { deleteCampaignEvent, watchCampaignEvents, type CampaignEvent } from "../services/campaignEventsService";
import { useAuth } from "../features/auth/AuthContext";
import { useCampaignDate } from "../features/calendar/useCampaignDate";
import {
  campaignDateLabel, dateKey, daysInMonth, firstWeekday, months, nextCampaignDay, parseCampaignDate,
} from "../features/calendar/campaignDates";
import { birthdayInYear, npcBirthday } from "../features/calendar/npcBirthdays";
import { loadNpcs, type LoadedNpcs } from "../services/aparicoesService";
import { changeCampaignDate } from "../services/campaignCalendarService";
import "../features/calendar/calendar.css";

const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function CampaignCalendarPage() {
  const { profile, user } = useAuth();
  const { date, ready, error } = useCampaignDate();
  const [catalog, setCatalog] = useState<LoadedNpcs>();
  const [catalogError, setCatalogError] = useState("");
  const [view, setView] = useState<{ year: number; month: number }>();
  const [selectedDay, setSelectedDay] = useState("");
  const [targetDate, setTargetDate] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [eventState, setEventState] = useState<{ month: string; events: CampaignEvent[]; error: string }>();
  const [eventRetry, setEventRetry] = useState(0);
  const [editingEvent, setEditingEvent] = useState<{ date: string; previous?: CampaignEvent }>();
  const [removingEvent, setRemovingEvent] = useState<CampaignEvent>();
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [eventNotice, setEventNotice] = useState("");

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    loadNpcs(user, controller.signal).then((value) => {
      if (!controller.signal.aborted) setCatalog(value);
    }).catch(() => {
      if (!controller.signal.aborted) setCatalogError("Os aniversários não puderam ser carregados.");
    });
    return () => controller.abort();
  }, [user]);

  const today = parseCampaignDate(date)!;
  const { year, month } = view || today;
  const monthKey = dateKey({ year, month, day: 1 }).slice(0, 7);
  useEffect(() => {
    if (!user) return;
    return watchCampaignEvents(monthKey,
      (events) => setEventState({ month: monthKey, events, error: "" }),
      () => setEventState({ month: monthKey, events: [], error: "Não foi possível carregar os eventos deste mês." }));
  }, [user, monthKey, eventRetry]);
  const monthEvents = eventState?.month === monthKey ? eventState.events : [];
  const eventsReady = eventState?.month === monthKey;
  const eventsError = eventsReady ? eventState.error : "";
  const activeDay = selectedDay.startsWith(monthKey + "-") ? selectedDay : "";
  const topicNames = useMemo(() => new Map(catalog?.topics.map(({ id, title }) => [id, title])), [catalog]);
  const birthdays = useMemo(() => (catalog?.records || []).flatMap((npc) => {
    const birth = npcBirthday(npc.fields);
    const day = birth && birthdayInYear(birth, year);
    return day && parseCampaignDate(day)?.month === month
      ? [{ date: day, npc }]
      : [];
  }).sort((a, b) => a.date.localeCompare(b.date) || a.npc.name.localeCompare(b.npc.name, "pt-BR")), [catalog, month, year]);
  const dayCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of birthdays) counts.set(entry.date, (counts.get(entry.date) || 0) + 1);
    return counts;
  }, [birthdays]);
  const displayed = activeDay ? birthdays.filter((entry) => entry.date === activeDay) : birthdays;
  const displayedEvents = activeDay ? monthEvents.filter((event) => event.date === activeDay) : monthEvents;
  const eventCounts = new Map<string, number>();
  for (const event of monthEvents) eventCounts.set(event.date, (eventCounts.get(event.date) || 0) + 1);
  const first = firstWeekday(year, month);

  function moveMonth(direction: -1 | 1) {
    const index = year * 12 + month - 1 + direction;
    setView({ year: Math.floor(index / 12), month: index % 12 + 1 });
    setSelectedDay("");
  }

  async function saveDate(value?: string) {
    if (saving || !ready) return;
    setSaving(true);
    setSaveError("");
    try {
      await changeCampaignDate(value);
      setTargetDate(undefined);
      setView(undefined);
      setSelectedDay("");
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Não foi possível mudar a data.");
    } finally {
      setSaving(false);
    }
  }

  function goToDate(event: FormEvent) {
    event.preventDefault();
    void saveDate(targetDate ?? date);
  }

  async function removeEvent() {
    if (!removingEvent || removing) return;
    setRemoving(true);
    setRemoveError("");
    try {
      await deleteCampaignEvent(removingEvent);
      setRemovingEvent(undefined);
      setEventNotice("Evento excluído.");
    } catch (cause) {
      setRemoveError(cause instanceof Error ? cause.message : "Não foi possível excluir o evento.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <main className="page campaign-calendar">
      <header className="page-heading campaign-heading">
        <div>
          <h1>Calendário</h1>
          <p>Datas, eventos e aniversários da campanha</p>
        </div>
        <div className="campaign-today">
          <CalendarDays aria-hidden="true" />
          <div aria-live="polite"><span>Hoje na campanha</span><time dateTime={date}>{campaignDateLabel(today)}</time></div>
        </div>
      </header>
      {error && <ErrorState text={error} />}
      {profile?.role === "admin" && (
        <Panel className="campaign-controls">
          <button type="button" className="primary" onClick={() => void saveDate()} disabled={saving || !ready || !nextCampaignDay(date)}>
            Avançar 1 dia
          </button>
          <form onSubmit={goToDate}>
            <label htmlFor="campaign-date">Data da campanha</label>
            <input id="campaign-date" type="date" min="0001-01-01" max="9999-12-31" required
              value={targetDate ?? date} onChange={(event) => setTargetDate(event.target.value)} disabled={saving || !ready} />
            <button type="submit" className="secondary" disabled={saving || !ready}>Ir para data</button>
          </form>
          <button type="button" className="secondary campaign-add-event"
            onClick={() => setEditingEvent({ date: activeDay || (date.startsWith(monthKey + "-") ? date : monthKey + "-01") })}>
            <Plus aria-hidden="true" /> Novo evento
          </button>
          {saving && <span role="status">Atualizando data…</span>}
          {saveError && <ErrorState text={saveError} />}
        </Panel>
      )}
      {eventNotice && <p className="form-success" role="status">{eventNotice}</p>}
      <div className="campaign-layout">
        <Panel className="campaign-month">
          <div className="campaign-month-heading">
            <button type="button" className="secondary" aria-label="Mês anterior" disabled={year === 1 && month === 1} onClick={() => moveMonth(-1)}><ChevronLeft /></button>
            <h2>{months[month - 1]} de {year}</h2>
            <button type="button" className="secondary" aria-label="Próximo mês" disabled={year === 9999 && month === 12} onClick={() => moveMonth(1)}><ChevronRight /></button>
            <button type="button" className="secondary campaign-current-month" onClick={() => { setView(undefined); setSelectedDay(""); }}>Mês atual</button>
          </div>
          <div className="campaign-weekdays" aria-hidden="true">{weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
          <ol className="campaign-days">
            {Array.from({ length: first }, (_, index) => <li key={`blank-${index}`} aria-hidden="true" />)}
            {Array.from({ length: daysInMonth(year, month) }, (_, index) => {
              const day = index + 1;
              const key = dateKey({ year, month, day });
              const count = dayCounts.get(key) || 0;
              const eventCount = eventCounts.get(key) || 0;
              const spoken = count === 1 ? ", 1 aniversário" : count ? `, ${count} aniversários` : "";
              const eventSpoken = eventCount === 1 ? ", 1 evento" : eventCount ? `, ${eventCount} eventos` : "";
              return <li key={key}><button type="button" aria-current={key === date ? "date" : undefined}
                aria-pressed={activeDay === key} aria-label={campaignDateLabel({ year, month, day }) + spoken + eventSpoken}
                onClick={() => setSelectedDay((old) => old === key ? "" : key)}>
                <span>{day}</span><span className="campaign-day-markers">
                  {count > 0 && <small><Cake aria-hidden="true" /> {count}</small>}
                  {eventCount > 0 && <small className="campaign-event-count"><Flag aria-hidden="true" /> {eventCount}</small>}
                </span>
              </button></li>;
            })}
          </ol>
        </Panel>
        <aside className="campaign-agenda">
          <Panel className="campaign-events" title={activeDay
            ? `Eventos de ${parseCampaignDate(activeDay)?.day} de ${months[month - 1]}` : "Eventos do mês"}>
            {activeDay && <button type="button" className="secondary campaign-clear-day" onClick={() => setSelectedDay("")}>Ver mês inteiro</button>}
            {!eventsReady && <p role="status" className="campaign-load">Carregando eventos…</p>}
            {eventsError && <div className="campaign-load"><ErrorState text={eventsError} />
              <button type="button" className="secondary" onClick={() => setEventRetry((value) => value + 1)}>Tentar de novo</button>
            </div>}
            {eventsReady && !eventsError && !displayedEvents.length && <Empty text={activeDay ? "Nenhum evento neste dia." : "Nenhum evento neste mês."} />}
            {displayedEvents.length > 0 && <ul>{displayedEvents.map((event) => (
              <li key={event.id}>
                <header>
                  <time dateTime={event.date}>{event.date.slice(8)}</time>
                  <h3>{event.title}</h3>
                  {profile?.role === "admin" && <div className="campaign-event-tools">
                    <button type="button" className="icon-button" aria-label={`Editar evento ${event.title}`}
                      onClick={() => setEditingEvent({ date: event.date, previous: event })}><Pencil /></button>
                    <button type="button" className="icon-button" aria-label={`Excluir evento ${event.title}`}
                      onClick={() => { setRemoveError(""); setRemovingEvent(event); }}><Trash2 /></button>
                  </div>}
                </header>
                {event.description && <p>{event.description}</p>}
              </li>
            ))}</ul>}
          </Panel>
          <Panel className="campaign-birthdays" title={activeDay
            ? `Aniversários de ${parseCampaignDate(activeDay)?.day} de ${months[month - 1]}`
            : "Aniversários do mês"}>
            {activeDay && <button className="secondary campaign-clear-day" type="button"
              onClick={() => setSelectedDay("")}>Ver mês inteiro</button>}
            {catalogError && <ErrorState text={catalogError} />}
            {catalog?.editsAvailable === false && <ErrorState text="Exibindo os aniversários das fichas originais." />}
            {!catalog && !catalogError && <p role="status" className="campaign-load">Carregando aniversários…</p>}
            {catalog && !displayed.length && <Empty text={activeDay ? "Nenhum aniversário neste dia." : "Nenhum aniversário neste mês."} />}
            {displayed.length > 0 && <ul>{displayed.map(({ npc, date: birthday }) => (
              <li key={npc.id}>
                <Link to={`/aparicoes?personagem=${encodeURIComponent(npc.id)}`} aria-label={`Abrir ficha de ${npc.name}`}>
                  <time dateTime={birthday}>{birthday.slice(8)}</time>
                  <span><strong>{npc.name}</strong><small>{topicNames.get(npc.topicId)}</small></span>
                  <ChevronRight aria-hidden="true" />
                </Link>
              </li>
            ))}</ul>}
          </Panel>
          </aside>
      </div>
      {profile?.role === "admin" && editingEvent && <CampaignEventEditor
        initialDate={editingEvent.date} previous={editingEvent.previous}
        onClose={() => setEditingEvent(undefined)} onSaved={(event) => {
          const next = parseCampaignDate(event.date)!;
          setView({ year: next.year, month: next.month });
          setSelectedDay(event.date);
          setEditingEvent(undefined);
          setEventNotice("Evento salvo.");
        }} />}
      {profile?.role === "admin" && removingEvent && <Modal title="Excluir evento"
        onClose={() => { if (!removing) setRemovingEvent(undefined); }}>
        <p>Excluir o evento <strong>{removingEvent.title}</strong> de {campaignDateLabel(parseCampaignDate(removingEvent.date)!)}?</p>
        {removeError && <div role="alert"><ErrorState text={removeError} /></div>}
        <div className="campaign-event-actions">
          <button type="button" className="secondary" disabled={removing} onClick={() => setRemovingEvent(undefined)}>Cancelar</button>
          <button type="button" className="danger" disabled={removing} onClick={() => void removeEvent()}>{removing ? "Excluindo…" : "Excluir evento"}</button>
        </div>
      </Modal>}
    </main>
  );
}
