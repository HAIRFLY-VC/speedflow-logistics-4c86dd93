import { centralDb } from "@/lib/central-db";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(context: { supabase: any; userId: string }) {
  const { data: isStaff } = await context.supabase.rpc("is_staff", {
    _user_id: context.userId,
  });
  if (!isStaff) throw new Error("Sem permissão");
}

export const solicitarCapturaCte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { reiniciarNsu?: boolean }) => ({
    reiniciarNsu: Boolean(data?.reiniciarNsu),
  }))
  .handler(async ({ context, data }) => {
    await assertStaff(context);

    const { data: pendente } = await centralDb
      .from("cte_captura_comandos")
      .select("id, status, created_at")
      .in("status", ["PENDENTE", "PROCESSANDO"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendente) {
      return { id: pendente.id as string, jaSolicitado: true };
    }

    const { data: novo, error } = await centralDb
      .from("cte_captura_comandos")
      .insert({ solicitado_por: context.userId, reiniciar_nsu: data.reiniciarNsu })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { id: novo.id as string, jaSolicitado: false };
  });


const LIMITE_PENDENTE_MS = 5 * 60 * 1000;
const LIMITE_PROCESSANDO_MS = 10 * 60 * 1000;

const LIMITE_ROBO_ONLINE_MS = 3 * 60 * 1000;

/** Último contato do robô local com o aplicativo (por rota consultada). */
export const getStatusRobo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { data } = await centralDb
      .from("robo_heartbeats")
      .select("origem, ultimo_contato, detalhe")
      .order("ultimo_contato", { ascending: false });
    const registros = (data ?? []) as {
      origem: string;
      ultimo_contato: string;
      detalhe: string | null;
    }[];
    const ultimo = registros[0]?.ultimo_contato ?? null;
    const filaComandos =
      registros.find((r) => r.origem === "cte-comandos")?.ultimo_contato ?? null;
    const sinalVida = registros.find((r) => r.origem === "robo");
    const varreduraNfe = registros.find((r) => r.origem === "nfe-nsu") ?? null;
    const online = ultimo
      ? Date.now() - new Date(ultimo).getTime() < LIMITE_ROBO_ONLINE_MS
      : false;
    return {
      ultimoContato: ultimo,
      ultimoContatoFilaComandos: filaComandos,
      estado: sinalVida?.detalhe ?? null,
      varreduraNfe: varreduraNfe
        ? { ultimoContato: varreduraNfe.ultimo_contato, detalhe: varreduraNfe.detalhe }
        : null,
      online,
    };
  });

export const getUltimoComandoCaptura = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { data, error } = await centralDb
      .from("cte_captura_comandos")
      .select("id, status, mensagem, novos_ctes, created_at, iniciado_em, concluido_em")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    // Expira comandos que o robô nunca assumiu ou deixou travados.
    const inicio = new Date((data.iniciado_em ?? data.created_at) as string).getTime();
    const decorrido = Date.now() - inicio;
    const expirado =
      (data.status === "PENDENTE" && decorrido > LIMITE_PENDENTE_MS) ||
      (data.status === "PROCESSANDO" && decorrido > LIMITE_PROCESSANDO_MS);

    if (expirado) {
      // Distingue "robô parado" de "robô ativo, porém ocupado" pelo sinal de vida.
      const { data: hbs } = await centralDb
        .from("robo_heartbeats")
        .select("origem, ultimo_contato, detalhe")
        .order("ultimo_contato", { ascending: false });
      const registros = (hbs ?? []) as {
        origem: string;
        ultimo_contato: string;
        detalhe: string | null;
      }[];
      const ultimoContato = registros[0]?.ultimo_contato;
      const estado = registros.find((r) => r.origem === "robo")?.detalhe ?? null;
      const online = ultimoContato
        ? Date.now() - new Date(ultimoContato).getTime() < LIMITE_ROBO_ONLINE_MS
        : false;

      let mensagem: string;
      if (!ultimoContato) {
        mensagem =
          "O robô nunca consultou a fila de importação deste aplicativo. Verifique se o serviço local está ativo e configurado com o endereço correto.";
      } else if (online) {
        mensagem = `O robô está ativo${
          estado ? ` (${estado})` : ""
        }, porém ocupado e não assumiu o pedido a tempo. Tente novamente em alguns minutos.`;
      } else {
        mensagem = `O robô está sem contato desde ${new Date(ultimoContato).toLocaleString(
          "pt-BR",
        )} — o serviço local provavelmente está parado ou travado. Reinicie o serviço RoboCTeSpeedFlow no servidor.`;
      }
      await centralDb
        .from("cte_captura_comandos")
        .update({ status: "ERRO", mensagem, concluido_em: new Date().toISOString() })
        .eq("id", data.id);
      return { ...data, status: "ERRO", mensagem };
    }

    return data;
  });



export const cancelarCapturaCte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { error } = await centralDb
      .from("cte_captura_comandos")
      .update({
        status: "ERRO",
        mensagem: "Cancelado pelo usuário",
        concluido_em: new Date().toISOString(),
      })
      .in("status", ["PENDENTE", "PROCESSANDO"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * CT-e descartados por remetente não cadastrado: sem empresa cadastrada
 * nenhum documento é importado, então isso precisa ficar visível na tela.
 */
export const getRemetentesIgnorados = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);

    const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: logs, error } = await centralDb
      .from("cte_ingest_logs")
      .select("cnpj_remetente, nome_remetente, mensagem, created_at")
      .eq("resultado", "IGNORADO")
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);

    const { data: empresas } = await centralDb.from("empresas").select("cnpj");
    const cadastrados = new Set((empresas ?? []).map((e: { cnpj: string }) => e.cnpj));

    const mapa = new Map<
      string,
      { cnpj: string; nome: string | null; total: number; ultimo: string }
    >();
    for (const l of logs ?? []) {
      const msg = (l.mensagem as string | null) ?? "";
      const cnpj =
        (l.cnpj_remetente as string | null) ??
        msg.match(/remetente\s+(\d{11,14})/)?.[1] ??
        null;
      if (!cnpj || cadastrados.has(cnpj)) continue;
      // A razão social vem do XML (tag xNome do remetente); logs antigos guardam
      // apenas na mensagem, então também tentamos extrair de lá.
      const nome =
        (l.nome_remetente as string | null) ??
        msg.match(/remetente\s+\d{11,14}\s+\(([^)]+)\)/)?.[1]?.trim() ??
        null;
      const atual = mapa.get(cnpj);
      if (atual) {
        atual.total += 1;
        if (!atual.nome && nome) atual.nome = nome;
      } else {
        mapa.set(cnpj, { cnpj, nome, total: 1, ultimo: l.created_at as string });
      }
    }


    return {
      totalEmpresas: (empresas ?? []).length,
      remetentes: Array.from(mapa.values()).sort((a, b) => b.total - a.total),
    };
  });

/** Cadastra a empresa remetente (detentora do certificado A1) a partir dos descartes. */
export const cadastrarEmpresaRemetente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { cnpj: string; razaoSocial?: string }) => {
    const cnpj = (data?.cnpj ?? "").replace(/\D/g, "");
    if (cnpj.length !== 14) throw new Error("CNPJ inválido");
    return { cnpj, razaoSocial: (data.razaoSocial ?? "").trim() };
  })
  .handler(async ({ context, data }) => {
    await assertStaff(context);

    const { data: existente } = await centralDb
      .from("empresas")
      .select("id")
      .eq("cnpj", data.cnpj)
      .maybeSingle();
    if (existente) return { id: existente.id as string, jaExistia: true };

    const razao = data.razaoSocial || `Empresa ${data.cnpj}`;
    const { data: nova, error } = await centralDb
      .from("empresas")
      .insert({ cnpj: data.cnpj, razao_social: razao, ativo: true })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: nova.id as string, jaExistia: false };
  });

