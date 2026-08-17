import { centralDb } from "@/lib/central-db";

export async function assertStaff(context: { supabase: any; userId: string }) {
  const { data: isStaff } = await context.supabase.rpc("is_staff", {
    _user_id: context.userId,
  });
  if (!isStaff) throw new Error("Sem permissão para esta operação");
}

/** Preenche `nome_destinatario` dos CT-e já importados, lendo o XML armazenado. */
export async function runBackfillNomeDestinatario() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { parseCteXml } = await import("./cte-parse.server");

  const { data: ctes, error } = await centralDb
    .from("ctes")
    .select("id, xml_storage_path")
    .is("nome_destinatario", null)
    .not("xml_storage_path", "is", null)
    .limit(500);
  if (error) throw new Error(error.message);

  let atualizados = 0;
  const erros: string[] = [];

  for (const c of ctes ?? []) {
    try {
      const { data: file, error: dlErr } = await supabaseAdmin.storage
        .from("cte-xml")
        .download(c.xml_storage_path as string);
      if (dlErr || !file) throw new Error(dlErr?.message ?? "XML não encontrado");
      const parsed = parseCteXml(await file.text());
      if (!parsed.nome_destinatario) continue;
      const { error: upErr } = await centralDb
        .from("ctes")
        .update({ nome_destinatario: parsed.nome_destinatario })
        .eq("id", c.id);
      if (upErr) throw new Error(upErr.message);
      atualizados++;
    } catch (e) {
      erros.push(`${c.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { total: ctes?.length ?? 0, atualizados, erros };
}

/** Resolve o nome do destinatário de um CT-e específico a partir do XML armazenado. */
export async function runResolverNomeDestinatario(cteId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { parseCteXml } = await import("./cte-parse.server");

  const { data: cte, error } = await centralDb
    .from("ctes")
    .select("id, nome_destinatario, xml_storage_path")
    .eq("id", cteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!cte) return { nome: null as string | null };
  if (cte.nome_destinatario) return { nome: cte.nome_destinatario };
  if (!cte.xml_storage_path) return { nome: null as string | null };

  const { data: file, error: dlErr } = await supabaseAdmin.storage
    .from("cte-xml")
    .download(cte.xml_storage_path);
  if (dlErr || !file) return { nome: null as string | null };

  const parsed = parseCteXml(await file.text());
  if (!parsed.nome_destinatario) return { nome: null as string | null };

  await centralDb
    .from("ctes")
    .update({ nome_destinatario: parsed.nome_destinatario })
    .eq("id", cte.id);

  return { nome: parsed.nome_destinatario };
}

/** Lê o endereço de entrega (enderDest) do XML armazenado de um CT-e. */
export async function runObterEnderecoEntregaCte(cteId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { parseEnderecoDestinatario } = await import("./cte-parse.server");

  const { data: cte, error } = await centralDb
    .from("ctes")
    .select("id, xml_storage_path")
    .eq("id", cteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!cte?.xml_storage_path) return { endereco: null };

  const { data: file, error: dlErr } = await supabaseAdmin.storage
    .from("cte-xml")
    .download(cte.xml_storage_path);
  if (dlErr || !file) return { endereco: null };

  return { endereco: parseEnderecoDestinatario(await file.text()) };
}

/** Lê o XML de um CT-e (coluna `xml_conteudo` com fallback no arquivo armazenado). */
async function lerXmlCte(cte: { xml_conteudo?: string | null; xml_storage_path?: string | null }) {
  if (cte.xml_conteudo && cte.xml_conteudo.includes("<")) return cte.xml_conteudo;
  if (!cte.xml_storage_path) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: file } = await supabaseAdmin.storage.from("cte-xml").download(cte.xml_storage_path);
  return file ? await file.text() : null;
}

/**
 * Recalcula o tomador do serviço (e a empresa responsável) de CT-e já
 * capturados, relendo o XML armazenado.
 */
export async function runReprocessarIdentificacaoCtes(data: {
  cteIds: string[] | null;
  somentePendentes: boolean;
}) {
  const { parseCteXml } = await import("./cte-parse.server");
  const { resolverEmpresaDoTomador } = await import("./cte-ingest.server");

  let q = centralDb
    .from("ctes")
    .select("id, status, transportadora_id, xml_conteudo, xml_storage_path")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (data.cteIds?.length) q = q.in("id", data.cteIds);
  else if (data.somentePendentes) q = q.is("tomador_cnpj", null);

  const { data: ctes, error } = await q;
  if (error) throw new Error(error.message);

  let processados = 0;
  let identificados = 0;
  let pendentes = 0;
  const erros: string[] = [];

  for (const c of ctes ?? []) {
    try {
      const xml = await lerXmlCte(
        c as { xml_conteudo?: string | null; xml_storage_path?: string | null },
      );
      if (!xml) continue;
      const parsed = parseCteXml(xml);
      const empresaId = await resolverEmpresaDoTomador(parsed);
      const status =
        (c as { transportadora_id: string | null }).transportadora_id && empresaId
          ? undefined
          : ("PENDENTE_IDENTIFICACAO" as const);

      const patch: Record<string, unknown> = {
        tomador_cnpj: parsed.tomador_cnpj,
        tomador_nome: parsed.tomador_nome,
        tomador_papel: parsed.tomador_papel,
        tipo_cte: parsed.tipo_cte,
        empresa_id: empresaId,
      };

      if (status) patch["status"] = status;

      const { error: upErr } = await centralDb
        .from("ctes")
        .update(patch as never)
        .eq("id", (c as { id: string }).id);
      if (upErr) throw new Error(upErr.message);

      processados++;
      if (empresaId) identificados++;
      else pendentes++;
    } catch (e) {
      erros.push(`${(c as { id: string }).id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { total: ctes?.length ?? 0, processados, identificados, pendentes, erros };
}
