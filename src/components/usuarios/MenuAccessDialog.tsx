import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useAuth";
import { ADMIN_ONLY_URLS, CUSTOM_MARK, NAV, useMenuAccess } from "@/lib/menu-items";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { mensagemErro } from "@/lib/mensagem-erro";

export function MenuAccessDialog({
  user,
  roles,
  onClose,
}: {
  user: { id: string; nome: string } | null;
  roles: AppRole[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const acesso = useMenuAccess(user?.id ?? null);
  const isAdm = roles.includes("adm");
  const disponiveis = NAV.filter((i) => isAdm || !ADMIN_ONLY_URLS.includes(i.url));
  const padrao = NAV.filter((i) => roles.some((r) => i.roles.includes(r))).map((i) => i.url);
  const [sel, setSel] = useState<string[]>([]);

  useEffect(() => {
    if (!user || acesso.isLoading) return;
    setSel(acesso.data ?? padrao);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, acesso.isLoading, acesso.data]);

  const salvar = useMutation({
    mutationFn: async (modo: "custom" | "padrao") => {
      if (!user) return;
      const { error: delErr } = await supabase.from("user_menu_access").delete().eq("user_id", user.id);
      if (delErr) throw delErr;
      if (modo === "padrao") return;
      let urls = sel.filter((u) => disponiveis.some((i) => i.url === u));
      if (isAdm && !urls.includes("/usuarios")) urls = [...urls, "/usuarios"];
      const linhas = [CUSTOM_MARK, ...urls].map((menu_url) => ({ user_id: user.id, menu_url }));
      const { error } = await supabase.from("user_menu_access").insert(linhas);
      if (error) throw error;
    },
    onSuccess: (_d, modo) => {
      qc.invalidateQueries({ queryKey: ["menu-access"] });
      toast.success(modo === "padrao" ? "Menu voltou ao padrão do papel" : "Acesso ao menu salvo");
      onClose();
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Acesso ao menu — {user?.nome}</DialogTitle>
          <DialogDescription>
            {acesso.data ? "Menu personalizado." : "Usando o menu padrão do papel."} Marque os itens que o usuário poderá ver.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setSel(disponiveis.map((i) => i.url))}>Marcar todos</Button>
          <Button size="sm" variant="outline" onClick={() => setSel([])}>Desmarcar todos</Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-auto py-1">
          {disponiveis.map((i) => {
            const travado = isAdm && i.url === "/usuarios";
            const marcado = travado || sel.includes(i.url);
            return (
              <label key={i.url} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={marcado}
                  disabled={travado}
                  onCheckedChange={(v) =>
                    setSel((s) => (v ? [...s, i.url] : s.filter((u) => u !== i.url)))
                  }
                />
                <i.icon className="h-4 w-4 text-muted-foreground" />
                {i.title}
              </label>
            );
          })}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" disabled={salvar.isPending} onClick={() => salvar.mutate("padrao")}>
            Voltar ao padrão do papel
          </Button>
          <Button disabled={salvar.isPending} onClick={() => salvar.mutate("custom")}>
            {salvar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
