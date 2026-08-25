import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getSidebarPref, saveSidebarPref } from "@/lib/ui-prefs.functions";
import {
  LayoutDashboard,
  Kanban,
  Users,
  Building2,
  
  ShoppingCart,
  Truck,
  Route as RouteIcon,
  FileText,
  Settings,
  LogOut,
  Menu,
  Wand2,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { toast } from "sonner";
import { NotificationsBell } from "./NotificationsBell";
import { ErpSyncButton } from "./ErpSyncButton";

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  roles: AppRole[];
};

const NAV: NavItem[] = [
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
  { title: "Pagamento de fretes", url: "/pagamento-fretes", icon: FileText, roles: ["adm", "gestor", "operador"] },



  { title: "Rotas", url: "/rotas", icon: RouteIcon, roles: ["adm", "gestor", "operador"] },
  { title: "Sugestão de rotas", url: "/sugestao-rotas", icon: Wand2, roles: ["adm", "gestor", "operador"] },
  { title: "Minhas Rotas", url: "/minhas-rotas", icon: RouteIcon, roles: ["fretista"] },
  { title: "Borderôs", url: "/borderos", icon: FileText, roles: ["adm", "gestor", "operador"] },
  { title: "Usuários", url: "/usuarios", icon: Users, roles: ["adm"] },
  { title: "Configurações", url: "/configuracoes", icon: Settings, roles: ["adm", "gestor", "operador", "fretista"] },
  { title: "Config. de fretes", url: "/configuracoes-fretes", icon: ShieldCheck, roles: ["adm"] },
  { title: "Captura de CT-e", url: "/captura-cte", icon: ShieldCheck, roles: ["adm"] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const loadPref = useServerFn(getSidebarPref);
  const savePref = useServerFn(saveSidebarPref);
  const [open, setOpen] = useState(true);
  const loadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadPref({})
      .then((res) => {
        if (cancelled) return;
        setOpen(res.open);
        loadedRef.current = true;
      })
      .catch(() => {
        loadedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [loadPref]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!loadedRef.current) return;
    savePref({ data: { open: next } }).catch(() => {});
  }

  return (
    <SidebarProvider open={open} onOpenChange={handleOpenChange}>
      <div className="min-h-dvh flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b flex items-center justify-between px-2 sm:px-3 gap-2 bg-card sticky top-0 z-10">
            <div className="flex items-center gap-2 min-w-0 order-1 sm:order-2">
              <Truck className="h-5 w-5 text-primary shrink-0" />
              <span className="font-semibold tracking-tight truncate">
                <span className="sm:hidden">SpeedFlow</span>
                <span className="hidden sm:inline">SpeedFlow Logistics</span>
              </span>
            </div>
            <div className="order-2 sm:order-3">
              <ErpSyncButton />
            </div>
            <div className="order-3 sm:order-4">
              <NotificationsBell />
            </div>
            <SidebarTrigger
              title="Comprimir ou expandir menu lateral"
              aria-label="Comprimir ou expandir menu lateral"
              className="h-10 w-10 order-4 sm:order-1"
            >
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
          </header>
          <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}


function AppSidebar() {
  const { role, user, signOut } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = NAV.filter((i) => (role ? i.roles.includes(role) : false));

  async function handleSignOut() {
    if (isMobile) setOpenMobile(false);
    await signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/auth" });
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="px-2 py-2 text-xs text-muted-foreground truncate">
          {user?.email}
          {role ? <div className="font-medium text-foreground uppercase">{role}</div> : null}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.url || pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link
                        to={item.url}
                        className="flex items-center gap-2 min-h-10 md:min-h-0"
                        onClick={() => {
                          if (isMobile) setOpenMobile(false);
                        }}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarToggleButton />
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="justify-start">
          <LogOut className="h-4 w-4 mr-2" />
          <span className="group-data-[collapsible=icon]:hidden">Sair</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

function SidebarToggleButton() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleSidebar}
      className="justify-start"
      title={collapsed ? "Expandir menu" : "Comprimir menu"}
    >
      {collapsed ? (
        <PanelLeftOpen className="h-4 w-4 mr-2" />
      ) : (
        <PanelLeftClose className="h-4 w-4 mr-2" />
      )}
      <span className="group-data-[collapsible=icon]:hidden">
        {collapsed ? "Expandir" : "Comprimir"}
      </span>
    </Button>
  );
}
