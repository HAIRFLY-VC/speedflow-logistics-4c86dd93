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

    const { data: cte, error } = await centralDb
      .from("ctes")
      .select("xml_storage_path")
      .eq("id", data.cteId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cte?.xml_storage_path) throw new Error("XML não disponível para este CT-e");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("cte-xml")
      .createSignedUrl(cte.xml_storage_path, 300);
    if (signErr || !signed) throw new Error(signErr?.message ?? "Falha ao gerar link");
    return { url: signed.signedUrl };
  });
