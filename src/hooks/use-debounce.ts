import { useEffect, useState } from "react";

const DEFAULT_DELAY_MS = 300;

/**
 * Debounce a value — returns the latest value only after `delay` ms of inactivity.
 * Useful for search inputs to avoid firing a request on every keystroke.
 */
export function useDebounce<T>(value: T, delay: number = DEFAULT_DELAY_MS): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delay);

    return (): void => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debounced;
}
