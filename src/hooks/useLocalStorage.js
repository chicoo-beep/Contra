import { useEffect, useState } from "react";

// Persist a piece of React state to localStorage. Reads once on mount,
// writes on every change. Safe against malformed/absent storage.
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw != null ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable (e.g. private mode) — fail quietly.
    }
  }, [key, value]);

  return [value, setValue];
}
