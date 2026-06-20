import { type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Kanban,
  Users,
  Package,
  ShoppingCart,
  Truck,
  Route as RouteIcon,
  FileText,
  Settings,
  LogOut,
  Menu,
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
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { toast } from "sonner";
import { NotificationsBell } from "./NotificationsBell";

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
  { title: "Produtos", url: "/produtos", icon: Package, roles: ["adm", "gestor", "operador"] },
  { title: "Fretistas", url: "/fretistas", icon: Truck, roles: ["adm", "gestor", "operador"] },
  { title: "Rotas", url: "/rotas", icon: RouteIcon, roles: ["adm", "gestor", "operador"] },
  { title: "Minhas Rotas", url: "/minhas-rotas", icon: RouteIcon, roles: ["fretista"] },
  { title: "Borderôs", url: "/borderos", icon: FileText, roles: ["adm", "gestor", "operador"] },
  { title: "Usuários", url: "/usuarios", icon: Users, roles: ["adm"] },
  { title: "Configurações", url: "/configuracoes", icon: Settings, roles: ["adm", "gestor", "operador", "fretista"] },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b flex items-center px-3 gap-2 bg-card sticky top-0 z-10">
            <SidebarTrigger title="Comprimir ou expandir menu lateral">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              <span className="font-semibold tracking-tight">Speed Logística</span>
            </div>
            <div className="ml-auto">
              <NotificationsBell />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppSidebar() {
  const { role, user, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = NAV.filter((i) => (role ? i.roles.includes(role) : false));

  async function handleSignOut() {
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
                      <Link to={item.url} className="flex items-center gap-2">
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
      <SidebarFooter>
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="justify-start">
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
