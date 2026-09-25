/**
 * Seção "Vínculo usuário do app ↔ Bitrix" da tela de Usuários.
 * Mesma funcionalidade da área de Configurações: busca usuário do Bitrix por
 * nome/código/e-mail e permite "Sugerir por e-mail".
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  listarUsuariosBitrixFn,
  listarVinculosBitrix,
  salvarVinculoBitrix,
  type UsuarioBitrixDto,
} from "@/lib/bitrix-config.functions";
import { LinhaVinculo } from "@/components/configuracoes/ConfigBitrixSection";

export function VinculoBitrixSection() {
  const qc = useQueryClient();
  const usuariosFn = useServerFn(listarUsuariosBitrixFn);
  const vinculosFn = useServerFn(listarVinculosBitrix);
  const salvarVinculoFn = useServerFn(salvarVinculoBitrix);

  const usuariosQ = useQuery({
    queryKey: ["bitrix-usuarios"],
    staleTime: 5 * 60_000,
    queryFn: () => usuariosFn({ data: undefined }),
    retry: 1,
  });
  const vinculosQ = useQuery({
    queryKey: ["bitrix-vinculos"],
    queryFn: () => vinculosFn({ data: undefined }),
  });

  const salvarVinculo = useMutation({
    mutationFn: (v: { userId: string; bitrix: UsuarioBitrixDto | null }) =>
      salvarVinculoFn({
        data: {
          userId: v.userId,
          bitrix_user_id: v.bitrix?.id ?? null,
          bitrix_user_nome: v.bitrix?.nome ?? null,
        },
      }),
    onSuccess: () => {
      toast.success("Vínculo salvo.");
      qc.invalidateQueries({ queryKey: ["bitrix-vinculos"] });
      qc.invalidateQueries({ queryKey: ["meu-vinculo-bitrix"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vínculo usuário do app ↔ Bitrix</CardTitle>
        <p className="text-xs text-muted-foreground">
          Obrigatório para autorizar pagamentos: a tarefa é criada em nome do usuário do Bitrix
          vinculado.
        </p>
      </CardHeader>
      <CardContent>
        {usuariosQ.isError ? (
          <p className="text-sm text-destructive">{(usuariosQ.error as Error).message}</p>
        ) : usuariosQ.isLoading || vinculosQ.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando usuários…
          </div>
        ) : (
          <div className="space-y-2">
            {(vinculosQ.data ?? []).map((u) => (
              <LinhaVinculo
                key={u.id}
                usuario={u}
                usuariosBitrix={usuariosQ.data ?? []}
                salvando={salvarVinculo.isPending}
                onSalvar={(bitrix) => salvarVinculo.mutate({ userId: u.id, bitrix })}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
