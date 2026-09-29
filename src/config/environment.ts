/** Detecção de ambiente pelo hostname. Use somente no navegador (efeitos/handlers). */
export const PRODUCTION_HOSTS = ["speedflow-logistics.lovable.app"];

export type AppEnv = "production" | "test";

export function getAppEnv(): AppEnv {
  if (typeof window === "undefined") return "test";
  return PRODUCTION_HOSTS.includes(window.location.hostname) ? "production" : "test";
}

export const isProduction = () => getAppEnv() === "production";
export const isTest = () => getAppEnv() === "test";
