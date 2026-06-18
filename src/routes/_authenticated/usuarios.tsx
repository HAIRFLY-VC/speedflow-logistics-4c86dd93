import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus, Shield, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { inviteUser } from "@/lib/users.functions";

export const Route = createFileRoute("/_authenticated/usuarios")({
  component: UsuariosPage,
});

const ROLE_OPTIONS: { value: AppRole; label: string; description: string }[] = [
  { value: "adm", label: "Administrador", description: "Acesso total" },
  { value: "gestor", label: "Gestor", description: "Aprovações e gestão" },
  { value: "operador", label: "Operador", description: "Comercial, crédito, separação" },
  { value: "fretista", label: "Fretista", description: "Apenas suas rotas e entregas" },
];

const ROLE_LABEL: Record<AppRole, string> = Object.fromEntries(
  ROLE_OPTIONS.map((r) => [r.value, r.label]),
) as Record<AppRole, string>;

function UsuariosPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const invite = useServerFn(inviteUser);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>(["operador"]);

  const isAdm = role === "adm";

  const profilesQ = useQuery({
    queryKey: ["users", "profiles"],
    enabled: isAdm,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rolesQ = useQuery({
    queryKey: ["users", "roles"],
    enabled: isAdm,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rolesByUser = useMemo(() => {
    const map = new Map<string, AppRole[]>();
    (rolesQ.data ?? []).forEach((r) => {
      const arr = map.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      map.set(r.user_id, arr);
    });
    return map;
  }, [rolesQ.data]);

  const toggleRole = useMutation({
    mutationFn: async ({
      userId,
      role: r,
      enable,
    }: {
      userId: string;
      role: AppRole;
      enable: boolean;
    }) => {
      if (enable) {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: r });
        if (error && !error.message.includes("duplicate")) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", r);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users", "roles"] });
      toast.success("Papéis atualizados");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const inviteMut = useMutation({
    mutationFn: async () =>
      invite({ data: { email, fullName, roles: selectedRoles } }),
    onSuccess: () => {
      toast.success("Convite enviado");
      setOpen(false);
      setEmail("");
      setFullName("");
      setSelectedRoles(["operador"]);
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdm) {
    return (
      <AppShell>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Apenas administradores podem gerenciar usuários.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Shield className="h-6 w-6" /> Usuários e Papéis
            </h1>
            <p className="text-sm text-muted-foreground">
              Convide membros e atribua papéis de acesso.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" /> Convidar usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar usuário</DialogTitle>
                <DialogDescription>
                  Um e-mail com link de acesso será enviado ao convidado.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="full_name">Nome completo *</Label>
                  <Input
                    id="full_name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Papéis *</Label>
                  {ROLE_OPTIONS.map((opt) => {
                    const checked = selectedRoles.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className="flex items-start gap-2 p-2 border rounded cursor-pointer hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setSelectedRoles((curr) =>
                              v
                                ? [...new Set([...curr, opt.value])]
                                : curr.filter((r) => r !== opt.value),
                            );
                          }}
                        />
                        <div>
                          <div className="text-sm font-medium">{opt.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {opt.description}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => inviteMut.mutate()}
                  disabled={
                    inviteMut.isPending ||
                    !email.trim() ||
                    !fullName.trim() ||
                    selectedRoles.length === 0
                  }
                >
                  {inviteMut.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  Enviar convite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Membros ({profilesQ.data?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profilesQ.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Papéis</TableHead>
                    <TableHead className="w-[320px]">Atribuir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(profilesQ.data ?? []).map((p) => {
                    const userRoles = rolesByUser.get(p.id) ?? [];
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {p.full_name || "—"}
                        </TableCell>
                        <TableCell>{p.phone || "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {userRoles.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                Sem papéis
                              </span>
                            ) : (
                              userRoles.map((r) => (
                                <Badge
                                  key={r}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {ROLE_LABEL[r]}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleRole.mutate({
                                        userId: p.id,
                                        role: r,
                                        enable: false,
                                      })
                                    }
                                    className="ml-1 hover:text-destructive"
                                    aria-label={`Remover ${ROLE_LABEL[r]}`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            {ROLE_OPTIONS.filter(
                              (o) => !userRoles.includes(o.value),
                            ).map((opt) => (
                              <Button
                                key={opt.value}
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() =>
                                  toggleRole.mutate({
                                    userId: p.id,
                                    role: opt.value,
                                    enable: true,
                                  })
                                }
                              >
                                + {opt.label}
                              </Button>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
