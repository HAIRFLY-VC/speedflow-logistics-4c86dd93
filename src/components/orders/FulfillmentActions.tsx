import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, PackageCheck, FileSignature, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { OrderStatus } from "@/lib/orderStatus";

export function FulfillmentActions({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const qc = useQueryClient();
  const { role, user } = useAuth();
  const canOperate = role === "adm" || role === "gestor" || role === "operador";
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [nfeNumber, setNfeNumber] = useState("");
  const [nfeKey, setNfeKey] = useState("");
  const [boletoUrl, setBoletoUrl] = useState("");

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["orders", orderId] });
    qc.invalidateQueries({ queryKey: ["orders", orderId, "history"] });
    qc.invalidateQueries({ queryKey: ["orders", orderId, "picking"] });
    qc.invalidateQueries({ queryKey: ["orders", orderId, "invoice"] });
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["kanban"] });
  }

  // Picking task for this order
  const pickingQ = useQuery({
    queryKey: ["orders", orderId, "picking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("picking_tasks")
        .select("id,started_at,finished_at,picker_id,notes")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const invoiceQ = useQuery({
    queryKey: ["orders", orderId, "invoice"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id,nfe_number,nfe_key,boleto_url,issued_at")
        .eq("order_id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Start picking: aguardando_faturamento -> em_separacao
  const startPicking = useMutation({
    mutationFn: async () => {
      const { error: tErr } = await supabase.from("picking_tasks").insert({
        order_id: orderId,
        picker_id: user?.id ?? null,
        started_at: new Date().toISOString(),
      });
      if (tErr) throw tErr;
      const { error } = await supabase
        .from("orders")
        .update({ status: "em_separacao" as OrderStatus })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Separação iniciada");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Finish picking: em_separacao -> aguardando_roteirizacao
  const finishPicking = useMutation({
    mutationFn: async () => {
      if (pickingQ.data?.id) {
        const { error: tErr } = await supabase
          .from("picking_tasks")
          .update({ finished_at: new Date().toISOString() })
          .eq("id", pickingQ.data.id);
        if (tErr) throw tErr;
      }
      const { error } = await supabase
        .from("orders")
        .update({ status: "aguardando_roteirizacao" as OrderStatus })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Separação concluída");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Issue invoice: aguardando_roteirizacao -> faturado
  const issueInvoice = useMutation({
    mutationFn: async () => {
      if (!nfeNumber.trim()) throw new Error("Informe o número da NF-e");
      const { error: iErr } = await supabase.from("invoices").insert({
        order_id: orderId,
        nfe_number: nfeNumber.trim(),
        nfe_key: nfeKey.trim() || null,
        boleto_url: boletoUrl.trim() || null,
        issued_by: user?.id ?? null,
      });
      if (iErr) throw iErr;
      const { error } = await supabase
        .from("orders")
        .update({ status: "faturado" as OrderStatus })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nota fiscal emitida");
      setInvoiceOpen(false);
      setNfeNumber("");
      setNfeKey("");
      setBoletoUrl("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Nothing to show outside fulfillment statuses (or when invoice already issued and shown)
  const showCard =
    status === "aguardando_faturamento" ||
    status === "em_separacao" ||
    status === "aguardando_roteirizacao" ||
    status === "faturado" ||
    pickingQ.data ||
    invoiceQ.data;

  if (!showCard) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Faturamento & Separação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Picking info */}
          {pickingQ.data ? (
            <div className="text-sm space-y-0.5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Separação
              </div>
              {pickingQ.data.started_at ? (
                <div>
                  Iniciada em{" "}
                  {format(new Date(pickingQ.data.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </div>
              ) : null}
              {pickingQ.data.finished_at ? (
                <div className="text-emerald-600">
                  Concluída em{" "}
                  {format(new Date(pickingQ.data.finished_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </div>
              ) : (
                <div className="text-amber-600">Em andamento</div>
              )}
            </div>
          ) : null}

          {/* Invoice info */}
          {invoiceQ.data ? (
            <div className="text-sm space-y-0.5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Nota fiscal
              </div>
              <div>NF-e: <span className="font-mono">{invoiceQ.data.nfe_number}</span></div>
              {invoiceQ.data.nfe_key ? (
                <div className="text-xs text-muted-foreground font-mono break-all">
                  {invoiceQ.data.nfe_key}
                </div>
              ) : null}
              {invoiceQ.data.boleto_url ? (
                <a
                  className="text-xs text-primary hover:underline"
                  href={invoiceQ.data.boleto_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Boleto
                </a>
              ) : null}
              <div className="text-xs text-muted-foreground">
                Emitida em{" "}
                {format(new Date(invoiceQ.data.issued_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </div>
            </div>
          ) : null}

          {/* Actions */}
          {!canOperate ? (
            <p className="text-sm text-muted-foreground">
              Sua função não permite operar faturamento/separação.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {status === "aguardando_faturamento" && (
                <Button
                  onClick={() => startPicking.mutate()}
                  disabled={startPicking.isPending}
                >
                  {startPicking.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Iniciar separação
                </Button>
              )}
              {status === "em_separacao" && (
                <Button
                  onClick={() => finishPicking.mutate()}
                  disabled={finishPicking.isPending}
                >
                  {finishPicking.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <PackageCheck className="h-4 w-4 mr-2" />
                  )}
                  Concluir separação
                </Button>
              )}
              {status === "aguardando_roteirizacao" && !invoiceQ.data && (
                <Button onClick={() => setInvoiceOpen(true)}>
                  <FileSignature className="h-4 w-4 mr-2" />
                  Emitir nota fiscal
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Emitir nota fiscal</DialogTitle>
            <DialogDescription>
              Informe os dados da NF-e. O pedido será movido para <strong>Faturado</strong> e estará pronto para a roteirização.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Número da NF-e *</Label>
              <Input value={nfeNumber} onChange={(e) => setNfeNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Chave de acesso</Label>
              <Input
                value={nfeKey}
                onChange={(e) => setNfeKey(e.target.value)}
                placeholder="44 dígitos"
                maxLength={60}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">URL do boleto</Label>
              <Input
                value={boletoUrl}
                onChange={(e) => setBoletoUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => issueInvoice.mutate()} disabled={issueInvoice.isPending}>
              {issueInvoice.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar emissão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
