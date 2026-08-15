import { centralDb } from "@/lib/central-db";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uploadSchema = z.object({
  xml: z.string().min(50).max(4_000_000),
});

export const uploadCteXml = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => uploadSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (!isStaff) throw new Error("Sem permissão para importar CT-e");

    const { ingestCteXml } = await import("./cte-ingest.server");
    return ingestCteXml({ xml: data.xml, origem: "MANUAL" });
  });

export const getCteXmlUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ cteId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (!isStaff) throw new Error("Sem permissão");

    const { lerXml } = await import("./xml-store.server");
    const xml = await lerXml("ctes", { coluna: "id", valor: data.cteId }, "cte-xml");
    if (!xml) throw new Error("XML não disponível para este CT-e");
    return { xml };
  });

/** Volumes e peso bruto das NF-es referenciadas no CT-e (+ totais do próprio CT-e). */
export const getVolumesNfesDoCte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ chaves: z.array(z.string()).max(200), cteId: z.string().uuid().optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (!isStaff) throw new Error("Sem permissão");

    const { coletarVolumesNfes, solicitarNfesDoCte } = await import("./nfe-volumes.server");
    await solicitarNfesDoCte(data.chaves, context.userId);
    const notas = await coletarVolumesNfes(data.chaves);

    // Fallback: enquanto os XMLs das NF-es não chegam, mostramos os totais de
    // carga declarados no próprio CT-e.
    let carga: import("./cte-parse.server").CteCarga | null = null;
    if (data.cteId) {
      try {
        const { lerXml } = await import("./xml-store.server");
        const xml = await lerXml("ctes", { coluna: "id", valor: data.cteId }, "cte-xml");
        if (xml) {
          const { parseCteCarga } = await import("./cte-parse.server");
          carga = parseCteCarga(xml);
        }
      } catch {
        carga = null;
      }
    }

    return { notas, carga };
  });
