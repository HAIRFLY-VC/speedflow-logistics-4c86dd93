import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Normaliza nome de rota vindo do ERP: remove espaços indevidos ao redor de
// hífens (ex.: "M- LIRA" -> "M-LIRA") e colapsa espaços múltiplos. Preserva
// hífens cercados por espaços em ambos os lados (ex.: "Sul - Centro").
export function normalizeRouteName(name: string): string {
  return name
    .replace(/(\S)-\s+(\S)/g, "$1-$2")
    .replace(/(\S)\s+-(\S)/g, "$1-$2")
    .replace(/\s+/g, " ")
    .trim();
}
