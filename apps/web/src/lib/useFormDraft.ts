'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Persists form state to localStorage on every change and restores on mount.
 * Prevents data loss when Uncle Teck's phone drops in an HDB basement.
 *
 * @param key   Unique localStorage key for this form
 * @param initial  Default form values (used when nothing is stored)
 * @returns [formData, setFormData, clearDraft]
 */
export function useFormDraft<T extends Record<string, unknown>>(
  key: string,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<T>;
        // Merge stored values over defaults so new fields get their defaults
        return { ...initial, ...parsed };
      }
    } catch {
      // Corrupt or unavailable storage — fall back to defaults
    }
    return initial;
  });

  const keyRef = useRef(key);
  keyRef.current = key;

  // Persist on every state change
  useEffect(() => {
    try {
      localStorage.setItem(keyRef.current, JSON.stringify(state));
    } catch {
      // Storage full or blocked — silently continue
    }
  }, [state]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(keyRef.current);
    } catch {
      // Ignore
    }
  }, []);

  return [state, setState, clearDraft];
}
