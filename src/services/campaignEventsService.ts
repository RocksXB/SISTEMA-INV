import { collection, doc, onSnapshot, query, runTransaction, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { dateKey, daysInMonth, parseCampaignDate } from "../features/calendar/campaignDates";

export type CampaignEvent = {
  id: string;
  title: string;
  date: string;
  description: string;
  revision: number;
};
export const maxEventTitle = 120;
export const maxEventDescription = 8_000;
const events = () => collection(db, "campaignEvents");
export const newCampaignEventId = () => doc(events()).id;

export function watchCampaignEvents(month: string, receive: (events: CampaignEvent[]) => void, fail: (error: Error) => void) {
  const start = parseCampaignDate(month + "-01");
  if (!start) throw Error("Mês inválido.");
  const end = dateKey({ ...start, day: daysInMonth(start.year, start.month) });
  const selection = query(events(), where("date", ">=", month + "-01"), where("date", "<=", end));
  return onSnapshot(selection, (snapshot) => {
    try {
      const entries = snapshot.docs.map((entry) => {
        const { title, date, description, revision } = entry.data();
        if (typeof title !== "string" || !parseCampaignDate(date) || typeof description !== "string" ||
            !Number.isSafeInteger(revision) || revision < 1) {
          throw Error("Há um evento com dados inválidos neste mês.");
        }
        return { id: entry.id, title, date: date as string, description, revision } as CampaignEvent;
      });
      receive(entries.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "pt-BR")));
    } catch (error) {
      fail(error instanceof Error ? error : Error("Não foi possível ler os eventos."));
    }
  }, fail);
}

export async function saveCampaignEvent(event: CampaignEvent): Promise<CampaignEvent> {
  const title = event.title.trim();
  if (!title || title.length > maxEventTitle) throw Error("Informe um título de até 120 caracteres.");
  if (!parseCampaignDate(event.date)) throw Error("Escolha uma data válida para o evento.");
  if (event.description.length > maxEventDescription) throw Error("Use até 8.000 caracteres na descrição.");
  const reference = doc(events(), event.id);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.exists() ? snapshot.data() : undefined;
    const revision = current?.revision ?? 0;
    if (revision !== event.revision) {
      if (current?.title === title && current?.date === event.date && current?.description === event.description) {
        return { ...event, title, revision: revision as number };
      }
      throw Error("O evento mudou em outra janela. Feche o editor e confira a versão atual.");
    }
    const saved = { title, date: event.date, description: event.description, revision: event.revision + 1 };
    transaction.set(reference, saved);
    return { id: event.id, ...saved };
  });
}

export async function deleteCampaignEvent(event: CampaignEvent) {
  const reference = doc(events(), event.id);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) return;
    if (snapshot.data().revision !== event.revision) {
      throw Error("O evento mudou em outra janela. Feche a confirmação e confira a versão atual.");
    }
    transaction.delete(reference);
  });
}
