import { useEffect, useState } from "react";
import { watchCampaignDate } from "../../services/campaignCalendarService";
import { initialCampaignDate } from "./campaignDates";

export function useCampaignDate() {
  const [date, setDate] = useState(initialCampaignDate);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => watchCampaignDate((value) => {
    setDate(value);
    setReady(true);
    setError("");
  }, () => {
    setReady(false);
    setError("A sincronização da data da campanha está indisponível.");
  }), []);
  return { date, ready, error };
}
