import { useQuery } from "@tanstack/react-query";
import {
  typeof,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useAuth";

export type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  roles: AppRole[];

export const CUSTOM_MARK = "__custom__";
export const ADMIN_ONLY_URLS = NAV.filter((i) => i.roles.length === 1 && i.roles[0] === "adm").map((i) => i.url);

/** null = menu padrão do papel; array = itens liberados (menu personalizado). */
export function useMenuAccess(userId: string | null) {
  return useQuery({
    queryKey: ["menu-access", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<string[] | null> => {
      const { data, error } = await supabase.from("user_menu_access").select("menu_url").eq("user_id", userId!);
      if (error) throw error;
      const urls = (data ?? []).map((r) => r.menu_url);
      return urls.includes(CUSTOM_MARK) ? urls.filter((u) => u !== CUSTOM_MARK) : null;
    },
  });
}

export function itemPermitido(item: NavItem, role: AppRole | null, liberados: string[] | null | undefined) {
  if (!role) return false;
  const doPapel = item.roles.includes(role) || (role === "adm" && item.roles.includes("adm"));
  if (!liberados) return item.roles.includes(role);
  if (role === "adm" && item.url === "/usuarios") return true;
  if (ADMIN_ONLY_URLS.includes(item.url) && role !== "adm") return false;
  return doPapel !== undefined && liberados.includes(item.url);
}

export function urlPermitida(pathname: string, role: AppRole | null, liberados: string[] | null | undefined) {
  const item = NAV.filter((i) => pathname === i.url || pathname.startsWith(i.url + "/"))
    .sort((a, b) => b.url.length - a.url.length)[0];
  if (!item) return true; // telas fora do menu não são bloqueadas aqui
  return itemPermitido(item, role, liberados);
}
