import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DependencyList,
} from "react";

interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useApiQuery<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList = [],
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [state, setState] = useState<QueryState<T>>({
    data: null,
    loading: Boolean(enabled),
    error: null,
  });
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState((current) => ({ ...current, loading: false, error: null }));
      return;
    }

    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    fetcherRef
      .current()
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState((current) => ({
          ...current,
          loading: false,
          error:
            error instanceof Error
              ? error
              : new Error("Something went wrong while loading data."),
        }));
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reloadKey, ...deps]);

  const setData = useCallback((data: T | null) => {
    setState((current) => ({ ...current, data }));
  }, []);

  return { ...state, reload, setData };
}
