import { doc, onSnapshot, runTransaction } from "firebase/firestore";
import { db } from "../lib/firebase";
import { initialCampaignDate, nextCampaignDay, parseCampaignDate } from "../features/calendar/campaignDates";

const calendar = () => doc(db, "campaignCalendar", "current");

export function watchCampaignDate(receive: (date: string) => void, fail: (error: Error) => void) {
  return onSnapshot(calendar(), (snapshot) => {
    const date = snapshot.exists() ? snapshot.data().date : initialCampaignDate;
    if (!parseCampaignDate(date)) {
      fail(Error("A data da campanha está inválida."));
      return;
    }
    receive(date);
  }, fail);
}

export async function changeCampaignDate(selected?: string) {
  if (selected !== undefined && !parseCampaignDate(selected)) throw Error("Escolha uma data válida.");
  const reference = calendar();
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.exists() ? snapshot.data().date : initialCampaignDate;
    const date = selected ?? nextCampaignDay(current);
    if (!date) throw Error("Não foi possível avançar a data da campanha.");
    if (!snapshot.exists() || date !== current) transaction.set(reference, { date });
    return date;
  });
}
