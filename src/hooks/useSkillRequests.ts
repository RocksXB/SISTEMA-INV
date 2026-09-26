import { useEffect, useState } from "react";
import { subscribeAllSkillRequests } from "../services/skillRequestService";
import type { SkillRequest } from "../types";

export function useAllSkillRequests() {
  const [requests, setRequests] = useState<SkillRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(
    () =>
      subscribeAllSkillRequests(
        (values) => {
          setRequests(values);
          setLoading(false);
        },
        () => {
          setError("Não foi possível sincronizar as solicitações de habilidades.");
          setLoading(false);
        },
      ),
    [],
  );

  return { requests, loading, error };
}
