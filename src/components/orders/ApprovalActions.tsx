import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/central/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
import type { Database } from "@/integrations/supabase/types";

type ApprovalType = Database["public"]["Enums"]["approval_type"];

export function ApprovalActions({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const qc = useQueryClient();
  const { role, user } = useAuth();
  const canApprove = role === "adm" || role === "gestor";
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  const approvalType: ApprovalType | null =
    status === "aguardando_aprovacao_comercial"
      ? "comercial"
      : status === "aguardando_aprovacao_credito"
        ? "credito"
        : null;

  const isReproved =
    status === "reprovado_comercial" || status === "reprovado_credito";

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["orders", orderId] });
    qc.invalidateQueries({ queryKey: ["orders", orderId, "history"] });
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["kanban"] });
  }

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!approvalType) throw new Error("Pedido não está aguardando aprovação");
      const nextStatus: OrderStatus =
        approvalType === "comercial"
          ? "aguardando_aprovacao_credito"
          : "aguardando_faturamento";
      const { error: aErr } = await supabase.from("approvals").insert({
        order_id: orderId,
        approval_type: approvalType,
        decision: "aprovado",
        decided_by: user?.id ?? null,
      });
      if (aErr) throw aErr;
      const { error: uErr } = await supabase
        .from("orders")
        .update({ status: nextStatus })
        .eq("id", orderId);
      if (uErr) throw uErr;
    },
    onSuccess: () => {
      toast.success("Aprovação registrada");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!approvalType) throw new Error("Pedido não está aguardando aprovação");
      if (!reason.trim()) throw new Error("Informe o motivo da reprovação");
      const nextStatus: OrderStatus =
        approvalType === "comercial" ? "reprovado_comercial" : "reprovado_credito";
      const { error: aErr } = await supabase.from("approvals").insert({
        order_id: orderId,
        approval_type: approvalType,
        decision: "reprovado",
        decided_by: user?.id ?? null,
        reason: reason.trim(),
      });
      if (aErr) throw aErr;
      const { error: uErr } = await supabase
        .from("orders")
        .update({ status: nextStatus })
        .eq("id", orderId);
      if (uErr) throw uErr;
    },
    onSuccess: () => {
      toast.success("Pedido reprovado");
      setRejectOpen(false);
      setReason("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reopenMutation = useMutation({
    mutationFn: async () => {
      const nextStatus: OrderStatus =
        status === "reprovado_comercial"
          ? "aguardando_aprovacao_comercial"
          : "aguardando_aprovacao_credito";
      const { error } = await supabase
        .from("orders")
        .update({ status: nextStatus })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido reaberto para nova análise");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!approvalType && !isReproved) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {approvalType === "comercial"
              ? "Aprovação comercial"
              : approvalType === "credito"
                ? "Aprovação de crédito"
                : "Pedido reprovado"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {!canApprove ? (
            <p className="text-sm text-muted-foreground">
              Apenas administradores e gestores podem decidir esta aprovação.
            </p>
          ) : approvalType ? (
            <>
              <Button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Aprovar
              </Button>
              <Button variant="destructive" onClick={() => setRejectOpen(true)}>
                <X className="h-4 w-4 mr-2" />
                Reprovar
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => reopenMutation.mutate()}
              disabled={reopenMutation.isPending}
            >
              {reopenMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Reabrir para nova análise
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar pedido</DialogTitle>
            <DialogDescription>
              Descreva o motivo da reprovação. Ele ficará registrado no histórico de aprovações.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Motivo *</Label>
            <Textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: cliente com pendência financeira, divergência de preço, etc."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar reprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
