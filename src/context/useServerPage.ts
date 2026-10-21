import { useEffect, useState } from "react";
import { api } from "../utils/api.ts";
import { useApp } from "./AppContext.tsx";
export function useServerPage<T>(
  path: string,
  query: string,
  page: number,
  limit = 25,
  refreshKey: unknown = null,
) {
  const { currentUser } = useApp();
  const [retry, setRetry] = useState(0);
  const key = `${currentUser?.id}:${path}:${query}:${page}:${limit}`;
  const [state, setState] = useState<{
    key: string;
    rows: T[];
    total: number;
    counts?: Record<string, number>;
    loading: boolean;
    error: string;
  }>({ key: "", rows: [], total: 0, loading: true, error: "" });
  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    setState({ key, rows: [], total: 0, loading: true, error: "" });
    api(
      `${path}?${query}&page=${page}&limit=${limit}`,
      "GET",
      undefined,
      {},
      { signal: abort.signal },
    )
      .then((r) => {
        if (active)
          setState({
            key,
            rows: r.data,
            total: r.pagination?.total ?? r.total ?? r.data.length,
            counts: r.counts,
            loading: false,
            error: "",
          });
      })
      .catch((e) => {
        if (active)
          setState({
            key,
            rows: [],
            total: 0,
            loading: false,
            error: e.message,
          });
      });
    return () => {
      active = false;
      abort.abort();
    };
  }, [key, retry, refreshKey]);
  return {
    ...(state.key === key
      ? state
      : {
          rows: [] as T[],
          total: 0,
          counts: undefined,
          loading: true,
          error: "",
        }),
    refresh: () => setRetry((n) => n + 1),
  };
}
export function useServerCollection<T>(
  path: string,
  query: string,
  refreshKey: unknown = null,
) {
  const { currentUser } = useApp();
  const key = `${currentUser?.id}:${path}:${query}`;
  const [state, setState] = useState<{
    key: string;
    rows: T[];
    loading: boolean;
    error: string;
  }>({ key: "", rows: [], loading: true, error: "" });
  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    setState({ key, rows: [], loading: true, error: "" });
    (async () => {
      let rows: T[] = [];
      let page = 1,
        total = Infinity;
      while (rows.length < total && active) {
        const r = await api(
          `${path}?${query}&page=${page++}&limit=100`,
          "GET",
          undefined,
          {},
          { signal: abort.signal },
        );
        rows.push(...r.data);
        total = r.total ?? r.data.length;
        if (!r.data.length) break;
      }
      if (active) setState({ key, rows, loading: false, error: "" });
    })().catch((e) => {
      if (active) setState({ key, rows: [], loading: false, error: e.message });
    });
    return () => {
      active = false;
      abort.abort();
    };
  }, [key, refreshKey]);
  return state.key === key
    ? state
    : { rows: [] as T[], loading: true, error: "" };
}
