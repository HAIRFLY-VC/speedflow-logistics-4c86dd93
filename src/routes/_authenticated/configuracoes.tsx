import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: ConfiguracoesPage,
});

type Form = {
  company_name: string;
  cnpj: string;
  email: string;
  phone: string;
  address: string;
  commercial_approval_threshold: string;
  credit_approval_threshold: string;
  auto_approve_below: string;
  sla_commercial_approval_hours: string;
  sla_credit_approval_hours: string;
  sla_fulfillment_hours: string;
  sla_delivery_hours: string;
  depot_address: string;
  max_route_weight_kg: string;
  max_route_value_brl: string;
  route_cluster_radius_km: string;
};

const empty: Form = {
  company_name: "",
  cnpj: "",
  email: "",
  phone: "",
  address: "",
  commercial_approval_threshold: "0",
  credit_approval_threshold: "0",
  auto_approve_below: "0",
  sla_commercial_approval_hours: "4",
  sla_credit_approval_hours: "8",
  sla_fulfillment_hours: "24",
  sla_delivery_hours: "48",
  depot_address: "",
  max_route_weight_kg: "5000",
  max_route_value_brl: "0",
  route_cluster_radius_km: "30",
};

function ConfiguracoesPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const canEdit = role === "adm";
  const [form, setForm] = useState<Form>(empty);

  const q = useQuery({
    queryKey: ["company_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (q.data) {
      setForm({
        company_name: q.data.company_name ?? "",
        cnpj: q.data.cnpj ?? "",
        email: q.data.email ?? "",
        phone: q.data.phone ?? "",
        address: q.data.address ?? "",
        commercial_approval_threshold: String(q.data.commercial_approval_threshold ?? 0),
        credit_approval_threshold: String(q.data.credit_approval_threshold ?? 0),
        auto_approve_below: String(q.data.auto_approve_below ?? 0),
        sla_commercial_approval_hours: String(q.data.sla_commercial_approval_hours ?? 4),
        sla_credit_approval_hours: String(q.data.sla_credit_approval_hours ?? 8),
        sla_fulfillment_hours: String(q.data.sla_fulfillment_hours ?? 24),
        sla_delivery_hours: String(q.data.sla_delivery_hours ?? 48),
      });
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        id: 1,
        company_name: form.company_name.trim() || "Speed Logística",
        cnpj: form.cnpj.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        commercial_approval_threshold: Number(form.commercial_approval_threshold) || 0,
        credit_approval_threshold: Number(form.credit_approval_threshold) || 0,
        auto_approve_below: Number(form.auto_approve_below) || 0,
        sla_commercial_approval_hours: Number(form.sla_commercial_approval_hours) || 0,
        sla_credit_approval_hours: Number(form.sla_credit_approval_hours) || 0,
        sla_fulfillment_hours: Number(form.sla_fulfillment_hours) || 0,
        sla_delivery_hours: Number(form.sla_delivery_hours) || 0,
      };
      const { error } = await supabase
        .from("company_settings")
        .upsert(payload, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["company_settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <AppShell>
      <div className="space-y-4 max-w-4xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Settings className="h-6 w-6" /> Configurações
          </h1>
          <p className="text-sm text-muted-foreground">
            Dados da empresa, regras de aprovação e SLAs.
          </p>
        </div>

        {q.isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados da empresa</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Razão social" value={form.company_name} onChange={set("company_name")} disabled={!canEdit} />
                <Field label="CNPJ" value={form.cnpj} onChange={set("cnpj")} disabled={!canEdit} />
                <Field label="E-mail" type="email" value={form.email} onChange={set("email")} disabled={!canEdit} />
                <Field label="Telefone" value={form.phone} onChange={set("phone")} disabled={!canEdit} />
                <div className="md:col-span-2">
                  <Label>Endereço</Label>
                  <Textarea
                    value={form.address}
                    onChange={(e) => set("address")(e.target.value)}
                    disabled={!canEdit}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Regras de aprovação</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Valores em R$ usados como referência pelo time comercial e de crédito.
                </p>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field
                  label="Aprovação comercial até (R$)"
                  type="number"
                  value={form.commercial_approval_threshold}
                  onChange={set("commercial_approval_threshold")}
                  disabled={!canEdit}
                />
                <Field
                  label="Aprovação de crédito até (R$)"
                  type="number"
                  value={form.credit_approval_threshold}
                  onChange={set("credit_approval_threshold")}
                  disabled={!canEdit}
                />
                <Field
                  label="Aprovação automática abaixo de (R$)"
                  type="number"
                  value={form.auto_approve_below}
                  onChange={set("auto_approve_below")}
                  disabled={!canEdit}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">SLAs (horas)</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Field label="Aprovação comercial" type="number" value={form.sla_commercial_approval_hours} onChange={set("sla_commercial_approval_hours")} disabled={!canEdit} />
                <Field label="Aprovação de crédito" type="number" value={form.sla_credit_approval_hours} onChange={set("sla_credit_approval_hours")} disabled={!canEdit} />
                <Field label="Faturamento" type="number" value={form.sla_fulfillment_hours} onChange={set("sla_fulfillment_hours")} disabled={!canEdit} />
                <Field label="Entrega" type="number" value={form.sla_delivery_hours} onChange={set("sla_delivery_hours")} disabled={!canEdit} />
              </CardContent>
            </Card>

            {canEdit ? (
              <div className="flex justify-end">
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar configurações
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-right">
                Apenas administradores podem editar.
              </p>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
