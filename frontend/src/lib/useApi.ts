import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";

/**
 * Small data loader for the live backend. It keeps prior data during refresh
 * and surfaces a readable error instead of falling back to demo records.
 */
export function useApiData<T>(
  loader: () => Promise<T>,
  deps: DependencyList = [],
) {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    loaderRef
      .current()
      .then((result) => {
        if (active) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setData(null);
        setLoading(false);
        setError(
          reason instanceof Error
            ? reason.message
            : "The Lifeline API request failed.",
        );
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, ...deps]);

  return { data, loading, error, reload, setData };
}
