import { useCallback, useEffect, useState } from "react";

interface UseTauriCommandResult<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  refetch: () => void;
}

/**
 * Hook to invoke a Tauri command and manage its state.
 * Automatically fetches on mount and provides a refetch function.
 */
export function useTauriCommand<T>(
  commandFn: () => Promise<T>,
  deps: unknown[] = [],
): UseTauriCommandResult<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await commandFn();
      setData(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, error, loading, refetch: fetch };
}
