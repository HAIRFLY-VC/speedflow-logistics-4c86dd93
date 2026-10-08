import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  Building2,
  FileText,
  Kanban,
  LayoutDashboard,
  MapPinned,
  PackageSearch,
  Percent,
  RouteIcon,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Wand2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useAuth";

export type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  roles: AppRole[];
};

export const NAV: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ["adm", "gestor", "operador"] },
  { title: "Kanban", url: "/kanban", icon: Kanban, roles: ["adm", "gestor", "operador"] },
  { title: "Pedidos", url: "/pedidos", icon: ShoppingCart, roles: ["adm", "gestor", "operador"] },
  { title: "Clientes", url: "/clientes", icon: Users, roles: ["adm", "gestor", "operador"] },
  { title: "Empresas", url: "/empresas", icon: Building2, roles: ["adm"] },
  
  { title: "Fretistas", url: "/fretistas", icon: Truck, roles: ["adm", "gestor", "operador"] },
  { title: "Transportadoras", url: "/transportadoras", icon: Truck, roles: ["adm", "gestor", "operador"] },
  { title: "Tabelas de frete", url: "/tabelas-frete", icon: FileText, roles: ["adm", "gestor", "operador"] },
  { title: "CT-e", url: "/ctes", icon: FileText, roles: ["adm", "gestor", "operador"] },
  { title: "Auditoria de fretes", url: "/auditoria-fretes", icon: FileText, roles: ["adm", "gestor", "operador"] },
  { title: "Pagamento de CT-e", url: "/pagamento-fretes", icon: FileText, roles: ["adm", "gestor", "operador"] },



  { title: "Rotas Pendentes", url: "/rotas", icon: RouteIcon, roles: ["adm", "gestor", "operador"] },
  { title: "Autorizar pagamento de frete", url: "/autorizar-pagamento-frete", icon: ShieldCheck, roles: ["adm", "gestor", "operador"] },
  { title: "Custo de frete", url: "/custo-frete", icon: Percent, roles: ["adm", "gestor", "operador"] },
  { title: "Pedidos sem rota", url: "/pedidos-sem-rota", icon: MapPinned, roles: ["adm", "gestor", "operador"] },
  { title: "Entregas em aberto", url: "/entregas-abertas", icon: PackageSearch, roles: ["adm", "gestor", "operador"] },
  { title: "Separação", url: "/separacao", icon: Boxes, roles: ["adm", "gestor", "operador"] },
  { title: "Sugestão de rotas", url: "/sugestao-rotas", icon: Wand2, roles: ["adm", "gestor", "operador"] },
  { title: "Minhas Rotas", url: "/minhas-rotas", icon: RouteIcon, roles: ["fretista"] },
  { title: "Usuários", url: "/usuarios", icon: Users, roles: ["adm"] },
  { title: "Configurações", url: "/configuracoes", icon: Settings, roles: ["adm", "gestor", "operador", "fretista"] },
  { title: "Config. de fretes", url: "/configuracoes-fretes", icon: ShieldCheck, roles: ["adm"] },
  { title: "Captura de CT-e", url: "/captura-cte", icon: ShieldCheck, roles: ["adm"] },
  { title: "Pendências de integração", url: "/pendencias-integracao", icon: AlertTriangle, roles: ["adm"] },

];

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
  if (!liberados) return item.roles.includes(role);
  if (role === "adm" && item.url === "/usuarios") return true;
  if (ADMIN_ONLY_URLS.includes(item.url) && role !== "adm") return false;
  return liberados.includes(item.url);
}

export function urlPermitida(pathname: string, role: AppRole | null, liberados: string[] | null | undefined) {
  // Só as telas de lista do menu são bloqueadas; telas de detalhe (ex.: /pedidos/123)
  // continuam acessíveis por links diretos (Minhas Rotas, notificações).
  const path = pathname.replace(/\/+$/, "") || "/";
  const item = NAV.find((i) => path === i.url);
  if (!item) return true; // telas fora do menu não são bloqueadas aqui
  return itemPermitido(item, role, liberados);
}
