import { useCallback, useEffect, useRef, useState } from 'react';

type Updater<T> = T | ((prev: T) => T);

/** Typed localStorage hook with SSR safety and serialization error handling. */
export function useLocalStorage<T>(
  key: string,
  initial: T,
): [T, (updater: Updater<T>) => void, () => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return initial;
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });

  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    try {
      window.localStorage.setItem(keyRef.current, JSON.stringify(value));
    } catch {
      // storage full or disabled — ignore
    }
  }, [value]);

  const update = useCallback((updater: Updater<T>) => {
    setValue((prev) =>
      typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater,
    );
  }, []);

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(keyRef.current);
    } catch {
      // ignore
    }
    setValue(initial);
  }, [initial]);

  return [value, update, clear];
}
