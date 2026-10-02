import { useEffect, useState } from "react";

export type PrintPaper = "A4" | "Letter";
export type PrintOrientation = "portrait" | "landscape";
export type PrintFontSize = "sm" | "md" | "lg";

export type PrintBasePrefs = {
  paper: PrintPaper;
  orientation: PrintOrientation;
  fontSize: PrintFontSize;
  economico: boolean;
};

/** Preferências de impressão lembradas por documento (localStorage). */
export function usePrintPrefs<T extends PrintBasePrefs>(key: string, defaults: T) {
  const storageKey = `print-prefs:${key}`;
  const [prefs, setPrefs] = useState<T>(defaults);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setPrefs({ ...defaults, ...(JSON.parse(raw) as Partial<T>) });
    } catch {
      /* ignora preferências inválidas */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  const update = (patch: Partial<T>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* sem storage */
      }
      return next;
    });
  return [prefs, update] as const;
}
