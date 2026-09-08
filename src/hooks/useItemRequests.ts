import { useEffect, useState } from "react";
import { subscribeAllItemRequests } from "../services/itemRequestService";
import type { ItemRequest } from "../types";

export function useAllItemRequests() {
  const [requests, setRequests] = useState<ItemRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(
    () =>
      subscribeAllItemRequests(
        (values) => {
          setRequests(values);
          setLoading(false);
        },
        () => {
          setError("Não foi possível sincronizar as solicitações.");
          setLoading(false);
        },
      ),
    [],
  );
  return { requests, loading, error };
}
