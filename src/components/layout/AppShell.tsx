import { BackButton, isDetailPath, useTrackNavigation } from "@/components/layout/BackButton";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getSidebarPref, saveSidebarPref } from "@/lib/ui-prefs.functions";
import { Truck, LogOut, Menu, PanelLeftClose, PanelLeftOpen, ShieldOff } from "lucide-react";
import { NAV, itemPermitido, urlPermitida, useMenuAccess } from "@/lib/menu-items";
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
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/lib/toast";
import { NotificationsBell } from "./NotificationsBell";
import { ErpSyncButton } from "./ErpSyncButton";
import { AppVersion } from "./AppVersion";
import { isFeatureOn } from "@/config/features";



export function AppShell({
  children,
  constrainViewport = false,
}: {
  children: ReactNode;
  constrainViewport?: boolean;
}) {
  useTrackNavigation();
  const loadPref = useServerFn(getSidebarPref);
  const savePref = useServerFn(saveSidebarPref);
  const [open, setOpen] = useState(true);
  const loadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    // Modo automático (computador + flag): menu inicia recolhido e abre com o mouse.
    const autoMode = window.innerWidth >= 768 && isFeatureOn("sidebarHoverExpand");
    if (autoMode) {
      setOpen(false);
      loadedRef.current = true;
      return;
    }
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

  const [hoverOpen, setHoverOpen] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleOpenChange(next: boolean) {
    // Clique no botão enquanto aberto pelo mouse = fixar aberto.
    if (hoverOpen) {
      next = !open;
      setHoverOpen(false);
    }
    setOpen(next);
    if (!loadedRef.current) return;
    savePref({ data: { open: next } }).catch(() => {});
  }

  function onSidebarEnter() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (open || window.innerWidth < 768 || !isFeatureOn("sidebarHoverExpand")) return;
    setHoverOpen(true);
  }
  function onSidebarLeave() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHoverOpen(false), 150);
  }

  return (
    <SidebarProvider open={open || hoverOpen} onOpenChange={handleOpenChange}>
      <div
        className={`${constrainViewport ? "h-dvh overflow-hidden" : "min-h-dvh"} flex w-full bg-background ${
          hoverOpen ? "[&>.group>div:first-child]:!w-[var(--sidebar-width-icon)] [&>.group>div:nth-child(2)]:!z-40 [&>.group>div:nth-child(2)]:shadow-xl" : ""
        }`}
      >
        <AppSidebar onMouseEnter={onSidebarEnter} onMouseLeave={onSidebarLeave} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b flex items-center justify-between px-2 sm:px-3 gap-2 bg-card sticky top-0 z-10">
            <div className="flex items-center gap-2 min-w-0 order-1 sm:order-2">
              <Truck className="h-5 w-5 text-primary shrink-0" />
              <div className="flex flex-col min-w-0 gap-0.5">
                <span className="font-semibold tracking-tight truncate leading-tight">
                  <span className="sm:hidden">SpeedFlow</span>
                  <span className="hidden sm:inline">SpeedFlow Logistics</span>
                </span>
                <AppVersion />
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 order-2 sm:order-3">
              <div>
                <ErpSyncButton />
              </div>
              <div className="md:hidden">
                <SidebarTrigger
                  title="Comprimir ou expandir menu lateral"
                  aria-label="Comprimir ou expandir menu lateral"
                  className="h-10 w-10"
                >
                  <Menu className="h-5 w-5" />
                </SidebarTrigger>
              </div>
              <div>
                <NotificationsBell />
              </div>
            </div>
          </header>
          <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-auto"><GlobalBack /><MenuGuard>{children}</MenuGuard></main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function SidebarCollapseButton() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleSidebar}
      className="h-8 w-8 shrink-0"
      title={collapsed ? "Expandir menu" : "Comprimir menu"}
      aria-label={collapsed ? "Expandir menu" : "Comprimir menu"}
    >
      {collapsed ? (
        <PanelLeftOpen className="h-4 w-4" />
      ) : (
        <PanelLeftClose className="h-4 w-4" />
      )}
    </Button>
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

function AppSidebar({
  onMouseEnter,
  onMouseLeave,
}: {
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const { role, user, signOut } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const acesso = useMenuAccess(user?.id ?? null);
  const items = NAV.filter((i) => itemPermitido(i, role, acesso.data));

  async function handleSignOut() {
    if (isMobile) setOpenMobile(false);
    await signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/auth" });
  }

  return (
    <Sidebar collapsible="icon" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <SidebarHeader>
        <div className="flex items-center justify-between gap-2 px-2 py-2 group-data-[collapsible=icon]:justify-center">
          <div className="text-xs text-muted-foreground truncate group-data-[collapsible=icon]:hidden">
            {user?.email}
            {role ? <div className="font-medium text-foreground uppercase">{role}</div> : null}
          </div>
          <SidebarCollapseButton />
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

function MenuGuard({ children }: { children: ReactNode }) {
  const { role, user, loading } = useAuth();
  const acesso = useMenuAccess(user?.id ?? null);
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  if (loading || !role || acesso.isLoading) return <>{children}</>;
  if (urlPermitida(pathname, role, acesso.data)) return <>{children}</>;
  return (
    <div className="max-w-md mx-auto mt-16 text-center space-y-3">
      <ShieldOff className="h-10 w-10 mx-auto text-muted-foreground" />
      <h1 className="text-lg font-semibold">Você não tem acesso a esta tela</h1>
      <p className="text-sm text-muted-foreground">Peça ao administrador para liberar este item do menu.</p>
      <Button asChild variant="outline"><Link to="/configuracoes">Ir para o início</Link></Button>
    </div>
  );
}

function GlobalBack() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (isDetailPath(pathname) || pathname === "/custo-frete") return null;
  return <BackButton className="-ml-2 mb-2" />;
}
