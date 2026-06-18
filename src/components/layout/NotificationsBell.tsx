import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orderStatus";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Notif = {
  id: string;
  order_id: string;
  order_number: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  changed_at: string;
  read: boolean;
};

const STORAGE_KEY = "speedlog.notifications.v1";
const LAST_SEEN_KEY = "speedlog.notifications.lastSeen";

function load(): Notif[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Notif[]) : [];
  } catch {
    return [];
  }
}

function save(items: Notif[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 50)));
  } catch {
    /* ignore */
  }
}

export function NotificationsBell() {
  const [items, setItems] = useState<Notif[]>(() => load());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const lastSeen =
      localStorage.getItem(LAST_SEEN_KEY) ?? new Date().toISOString();

    const channel = supabase
      .channel("order-status-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_status_history",
        },
        async (payload) => {
          const row = payload.new as {
            id: string;
            order_id: string;
            from_status: OrderStatus | null;
            to_status: OrderStatus;
            changed_at: string;
          };
          if (new Date(row.changed_at).getTime() <= new Date(lastSeen).getTime()) {
            return;
          }
          const { data: order } = await supabase
            .from("orders")
            .select("order_number")
            .eq("id", row.order_id)
            .maybeSingle();
          const notif: Notif = {
            id: row.id,
            order_id: row.order_id,
            order_number: order?.order_number ?? row.order_id.slice(0, 8),
            from_status: row.from_status,
            to_status: row.to_status,
            changed_at: row.changed_at,
            read: false,
          };
          setItems((cur) => {
            if (cur.some((n) => n.id === notif.id)) return cur;
            const next = [notif, ...cur].slice(0, 50);
            save(next);
            return next;
          });
          toast(`Pedido #${notif.order_number}`, {
            description: `Status: ${ORDER_STATUS_LABEL[notif.to_status]}`,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const unread = items.filter((n) => !n.read).length;

  function markAllRead() {
    const next = items.map((n) => ({ ...n, read: true }));
    setItems(next);
    save(next);
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
  }

  function clearAll() {
    setItems([]);
    save([]);
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && unread > 0) markAllRead();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-medium">Notificações</span>
          {items.length > 0 ? (
            <button
              onClick={clearAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Limpar
            </button>
          ) : null}
        </div>
        <div className="max-h-80 overflow-auto">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-6 text-center">
              Sem notificações por enquanto.
            </p>
          ) : (
            items.map((n) => (
              <Link
                key={n.id}
                to="/pedidos/$orderId"
                params={{ orderId: n.order_id }}
                onClick={() => setOpen(false)}
                className="block px-3 py-2 border-b last:border-0 hover:bg-muted/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">#{n.order_number}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.changed_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {n.from_status ? `${ORDER_STATUS_LABEL[n.from_status]} → ` : ""}
                  <span className="text-foreground font-medium">
                    {ORDER_STATUS_LABEL[n.to_status]}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
