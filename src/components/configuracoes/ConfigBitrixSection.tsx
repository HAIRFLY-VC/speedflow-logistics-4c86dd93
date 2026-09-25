/**
 * Seção "Tarefas do Bitrix" da tela de Configurações (somente administradores).
 * - Lista os usuários ativos do Bitrix (código, nome, cargo, e-mail) com busca.
 * - Define responsável e observadores padrão das tarefas criadas pelo app.
 * - Vincula usuários do app a usuários do Bitrix (o criador da tarefa é o
 *   usuário do Bitrix vinculado a quem autorizou o pagamento).
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Search, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  listarUsuariosBitrixFn,
  listarVinculosBitrix,
  obterConfigBitrix,
  salvarConfigBitrix,
  salvarVinculoBitrix,
  type UsuarioAppVinculoDto,
  type UsuarioBitrixDto,
} from "@/lib/bitrix-config.functions";

function rotulo(u: UsuarioBitrixDto): string {
  return `${u.id} — ${u.nome}`;
}

/** Campo de busca de usuário do Bitrix com lista filtrada. */
function BuscaUsuarioBitrix({
  usuarios,
  selecionado,
  onSelecionar,
  placeholder,
}: {
  usuarios: UsuarioBitrixDto[];
  selecionado: { id: number; nome: string } | null;
  onSelecionar: (u: UsuarioBitrixDto | null) => void;
  placeholder: string;
}) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return usuarios.slice(0, 20);
    return usuarios
      .filter(
        (u) =>
          u.nome.toLowerCase().includes(termo) ||
          String(u.id).includes(termo) ||
          (u.email ?? "").toLowerCase().includes(termo),
      )
      .slice(0, 20);
  }, [usuarios, busca]);

  if (selecionado) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
        <span className="flex-1 font-medium">{selecionado.id} — {selecionado.nome}</span>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => onSelecionar(null)}
          aria-label="Remover seleção"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        className="pl-8"
        placeholder={placeholder}
        value={busca}
        onChange={(e) => {
          setBusca(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 200)}
      />
      {aberto && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover shadow-md">
          {filtrados.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
          ) : (
            filtrados.map((u) => (
              <button
                key={u.id}
                type="button"
                className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-accent"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelecionar(u);
                  setBusca("");
                  setAberto(false);
                }}
              >
                <span className="text-sm font-medium">{rotulo(u)}</span>
                <span className="text-xs text-muted-foreground">
                  {[u.cargo, u.email].filter(Boolean).join(" · ") || "—"}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function ConfigBitrixSection() {
  const qc = useQueryClient();
  const usuariosFn = useServerFn(listarUsuariosBitrixFn);
  const configFn = useServerFn(obterConfigBitrix);
  const vinculosFn = useServerFn(listarVinculosBitrix);
  const salvarConfigFn = useServerFn(salvarConfigBitrix);
  const salvarVinculoFn = useServerFn(salvarVinculoBitrix);

  const usuariosQ = useQuery({
    queryKey: ["bitrix-usuarios"],
    staleTime: 5 * 60_000,
    queryFn: () => usuariosFn({ data: undefined }),
    retry: 1,
  });
  const configQ = useQuery({
    queryKey: ["bitrix-config"],
    queryFn: () => configFn({ data: undefined }),
  });
  const vinculosQ = useQuery({
    queryKey: ["bitrix-vinculos"],
    queryFn: () => vinculosFn({ data: undefined }),
  });

  const usuarios = usuariosQ.data ?? [];
  const nomeDe = (id: number) => usuarios.find((u) => u.id === id)?.nome ?? "";

  const [responsavel, setResponsavel] = useState<{ id: number; nome: string } | null>(null);
  const [observadores, setObservadores] = useState<{ id: number; nome: string }[]>([]);
  const [inicializado, setInicializado] = useState(false);

  // Preenche uma vez com os valores atuais (responsável 30, observadores 24/54/1).
  if (configQ.data && usuariosQ.data && !inicializado) {
    const c = configQ.data;
    setResponsavel(
      c.responsavel_id
        ? { id: c.responsavel_id, nome: c.responsavel_nome || nomeDe(c.responsavel_id) || "?" }
        : null,
    );
    setObservadores(
      c.observadores.map((o) => ({ id: o.id, nome: o.nome || nomeDe(o.id) || "?" })),
    );
    setInicializado(true);
  }

  const salvarConfig = useMutation({
    mutationFn: () => {
      if (!responsavel) throw new Error("Escolha o responsável padrão das tarefas.");
      return salvarConfigFn({
        data: {
          responsavel_id: responsavel.id,
          responsavel_nome: responsavel.nome,
          observadores,
        },
      });
    },
    onSuccess: () => {
      toast.success("Configuração do Bitrix salva.");
      qc.invalidateQueries({ queryKey: ["bitrix-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
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

  if (usuariosQ.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tarefas do Bitrix</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            {(usuariosQ.error as Error).message}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tarefas do Bitrix</CardTitle>
        <p className="text-xs text-muted-foreground">
          Participantes das tarefas criadas pelo app no Bitrix. O criador da tarefa é o usuário
          do Bitrix vinculado a quem autorizou o pagamento — sem vínculo, a confirmação fica bloqueada.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {usuariosQ.isLoading || configQ.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando usuários do Bitrix…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Responsável padrão das tarefas</Label>
                <BuscaUsuarioBitrix
                  usuarios={usuarios}
                  selecionado={responsavel}
                  onSelecionar={(u) => setResponsavel(u ? { id: u.id, nome: u.nome } : null)}
                  placeholder="Buscar por nome ou código…"
                />
              </div>
              <div className="space-y-2">
                <Label>Observadores padrão</Label>
                <div className="flex flex-wrap gap-2">
                  {observadores.map((o) => (
                    <span
                      key={o.id}
                      className="flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 text-xs"
                    >
                      {o.id} — {o.nome}
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => setObservadores((prev) => prev.filter((x) => x.id !== o.id))}
                        aria-label={`Remover ${o.nome}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <BuscaUsuarioBitrix
                  usuarios={usuarios.filter((u) => !observadores.some((o) => o.id === u.id))}
                  selecionado={null}
                  onSelecionar={(u) =>
                    u && setObservadores((prev) => [...prev, { id: u.id, nome: u.nome }])
                  }
                  placeholder="Adicionar observador…"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => salvarConfig.mutate()} disabled={salvarConfig.isPending}>
                {salvarConfig.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar
              </Button>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div>
                <Label className="text-sm font-semibold">Vínculo usuário do app ↔ Bitrix</Label>
                <p className="text-xs text-muted-foreground">
                  Obrigatório para autorizar pagamentos: a tarefa é criada em nome do usuário do
                  Bitrix vinculado.
                </p>
              </div>
              {vinculosQ.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando usuários do app…
                </div>
              ) : (
                <div className="space-y-2">
                  {(vinculosQ.data ?? []).map((u) => (
                    <LinhaVinculo
                      key={u.id}
                      usuario={u}
                      usuariosBitrix={usuarios}
                      salvando={salvarVinculo.isPending}
                      onSalvar={(bitrix) => salvarVinculo.mutate({ userId: u.id, bitrix })}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function LinhaVinculo({
  usuario,
  usuariosBitrix,
  salvando,
  onSalvar,
}: {
  usuario: UsuarioAppVinculoDto;
  usuariosBitrix: UsuarioBitrixDto[];
  salvando: boolean;
  onSalvar: (bitrix: UsuarioBitrixDto | null) => void;
}) {
  const vinculoAtual = usuario.bitrix_user_id
    ? { id: usuario.bitrix_user_id, nome: usuario.bitrix_user_nome ?? "?" }
    : null;
  const [selecionado, setSelecionado] = useState<{ id: number; nome: string } | null>(null);

  const sugerirPorEmail = () => {
    const email = (usuario.email ?? "").trim().toLowerCase();
    if (!email) {
      toast.error("Usuário do app sem e-mail cadastrado.");
      return;
    }
    const encontrado = usuariosBitrix.find((u) => (u.email ?? "").trim().toLowerCase() === email);
    if (!encontrado) {
      toast.error("Nenhum usuário do Bitrix com esse e-mail.");
      return;
    }
    setSelecionado({ id: encontrado.id, nome: encontrado.nome });
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center">
      <div className="min-w-0 md:w-64">
        <p className="truncate text-sm font-medium">{usuario.full_name ?? "Sem nome"}</p>
        <p className="truncate text-xs text-muted-foreground">{usuario.email ?? "—"}</p>
      </div>
      <div className="flex-1">
        {selecionado ? (
          <div className="flex items-center gap-2 rounded-md border bg-accent/40 px-3 py-2 text-sm">
            <span className="flex-1 font-medium">{selecionado.id} — {selecionado.nome}</span>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setSelecionado(null)}
              aria-label="Cancelar seleção"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : vinculoAtual ? (
          <p className="text-sm">
            <span className="font-medium">{vinculoAtual.id} — {vinculoAtual.nome}</span>
          </p>
        ) : (
          <BuscaUsuarioBitrix
            usuarios={usuariosBitrix}
            selecionado={null}
            onSelecionar={(u) => setSelecionado(u ? { id: u.id, nome: u.nome } : null)}
            placeholder="Buscar usuário do Bitrix…"
          />
        )}
      </div>
      <div className="flex gap-2">
        {!selecionado && !vinculoAtual && (
          <Button type="button" variant="outline" size="sm" onClick={sugerirPorEmail}>
            Sugerir por e-mail
          </Button>
        )}
        {selecionado && (
          <Button
            type="button"
            size="sm"
            disabled={salvando}
            onClick={() => {
              const u = usuariosBitrix.find((x) => x.id === selecionado.id) ?? {
                id: selecionado.id,
                nome: selecionado.nome,
                email: null,
                cargo: null,
              };
              onSalvar(u);
              setSelecionado(null);
            }}
          >
            Salvar
          </Button>
        )}
        {vinculoAtual && !selecionado && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={salvando}
            onClick={() => onSalvar(null)}
          >
            Remover vínculo
          </Button>
        )}
        {vinculoAtual && !selecionado && (
          <BuscaUsuarioBitrix
            usuarios={usuariosBitrix}
            selecionado={null}
            onSelecionar={(u) => setSelecionado(u ? { id: u.id, nome: u.nome } : null)}
            placeholder="Trocar…"
          />
        )}
      </div>
    </div>
  );
}
