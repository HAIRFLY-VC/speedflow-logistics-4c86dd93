import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/orderStatus";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/produtos")({
  component: ProdutosPage,
});

type Product = Tables<"products">;

const productSchema = z.object({
  sku: z.string().trim().min(1, "SKU é obrigatório").max(60),
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(200),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  unit_price: z.coerce.number().min(0, "Não pode ser negativo"),
  weight_kg: z
    .union([z.coerce.number().min(0), z.literal("")])
    .optional(),
  stock_qty: z.coerce.number().min(0, "Não pode ser negativo"),
  is_active: z.boolean(),
});
type ProductInput = z.infer<typeof productSchema>;

function ProdutosPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data ?? [];
    return (data ?? []).filter((p) =>
      [p.name, p.sku, p.description].filter(Boolean).some((v) => v!.toLowerCase().includes(term)),
    );
  }, [data, search]);

  const upsertMutation = useMutation({
    mutationFn: async (input: ProductInput) => {
      const payload = {
        ...input,
        description: input.description || null,
        weight_kg: input.weight_kg === "" || input.weight_kg === undefined ? null : input.weight_kg,
      } as never;
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(editing ? "Produto atualizado" : "Produto criado");
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (p: Product) => {
      const { error } = await supabase
        .from("products")
        .update({ is_active: !p.is_active })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Produtos</h1>
            <p className="text-muted-foreground text-sm">
              Catálogo de produtos disponíveis para venda.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Novo produto
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="border rounded-lg overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Peso (kg)</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
                <TableHead className="text-center">Ativo</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    Nenhum produto encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      {p.description ? (
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {p.description}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(Number(p.unit_price ?? 0))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.weight_kg ? Number(p.weight_kg).toFixed(2) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(p.stock_qty ?? 0)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={p.is_active}
                        onCheckedChange={() => toggleActive.mutate(p)}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(p);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <ProductDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
        onSubmit={(v) => upsertMutation.mutate(v)}
        submitting={upsertMutation.isPending}
      />
    </AppShell>
  );
}

function ProductDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Product | null;
  onSubmit: (v: ProductInput) => void;
  submitting: boolean;
}) {
  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: editing?.sku ?? "",
      name: editing?.name ?? "",
      description: editing?.description ?? "",
      unit_price: Number(editing?.unit_price ?? 0),
      weight_kg: editing?.weight_kg != null ? Number(editing.weight_kg) : "",
      stock_qty: Number(editing?.stock_qty ?? 0),
      is_active: editing?.is_active ?? true,
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
          <DialogDescription>Informações do item no catálogo.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <Field label="SKU *" error={form.formState.errors.sku?.message}>
            <Input {...form.register("sku")} />
          </Field>
          <Field label="Nome *" error={form.formState.errors.name?.message}>
            <Input {...form.register("name")} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Descrição">
              <Textarea rows={3} {...form.register("description")} />
            </Field>
          </div>
          <Field label="Preço unitário (R$) *" error={form.formState.errors.unit_price?.message}>
            <Input type="number" step="0.01" min="0" {...form.register("unit_price")} />
          </Field>
          <Field label="Peso (kg)">
            <Input type="number" step="0.001" min="0" {...form.register("weight_kg")} />
          </Field>
          <Field label="Estoque *" error={form.formState.errors.stock_qty?.message}>
            <Input type="number" step="1" min="0" {...form.register("stock_qty")} />
          </Field>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.watch("is_active")}
              onCheckedChange={(v) => form.setValue("is_active", v)}
              id="p_is_active"
            />
            <Label htmlFor="p_is_active">Produto ativo</Label>
          </div>

          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
