import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getTablePrefs, saveTablePrefs, type TablePreferences } from "@/lib/table-prefs.functions";

export type PrintPaper = "A4" | "Letter";
export type PrintOrientation = "portrait" | "landscape";
export type PrintFontSize = "sm" | "md" | "lg";

export type PrintBasePrefs = {
  paper: PrintPaper;
  orientation: PrintOrientation;
  fontSize: PrintFontSize;
  economico: boolean;
};

/**
 * Preferências de impressão por documento, salvas no perfil do usuário
 * (user_table_preferences, chave `print:<doc>`), com cópia local como cache.
 */
export function usePrintPrefs<T extends PrintBasePrefs>(key: string, defaults: T) {
  const storageKey = `print-prefs:${key}`;
  const tableKey = `print:${key}`;
  const [prefs, setPrefs] = useState<T>(defaults);
  const fetchPrefs = useServerFn(getTablePrefs);
  const savePrefs = useServerFn(saveTablePrefs);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touched = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setPrefs({ ...defaults, ...(JSON.parse(raw) as Partial<T>) });
    } catch {
      /* ignora */
    }
    fetchPrefs({ data: { tableKey } })
      .then((remote) => {
        if (!remote || touched.current) return;
        const next = { ...defaults, ...(remote as unknown as Partial<T>) };
        setPrefs(next);
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          /* sem storage */
        }
      })
      .catch(() => {
        /* mantém cópia local */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const update = (patch: Partial<T>) => {
    touched.current = true;
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* sem storage */
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        savePrefs({ data: { tableKey, preferences: next as unknown as TablePreferences } }).catch(() => {});
      }, 600);
      return next;
    });
  };
  return [prefs, update] as const;
}
