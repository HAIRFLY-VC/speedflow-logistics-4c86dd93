import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const triggerErpSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Autoriza: só adm/gestor podem disparar
    const { data: isAdm } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "adm",
    });
    const { data: isGestor } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "gestor",
    });
    if (!isAdm && !isGestor) {
      throw new Error("Apenas administradores ou gestores podem importar do ERP");
    }

    const { syncErpOrders } = await import("./erp-sync.server");
    return syncErpOrders({ trigger: "manual", triggeredBy: context.userId });
  });

export const checkErpConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdm } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "adm",
    });
    const { data: isGestor } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "gestor",
    });
    const allowed = Boolean(isAdm || isGestor);
    const hasBaseUrl = Boolean(process.env.ERP_API_BASE_URL);
    const hasApiKey = Boolean(process.env.ERP_API_KEY);
    return {
      allowed,
      hasBaseUrl,
      hasApiKey,
      ready: allowed && hasBaseUrl && hasApiKey,
    };
  });

/** Busca no ERP a UF/cidade de clientes que estão sem UF no espelho local e grava. */
export const completarUfClientes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { cods: string[] }) => ({
    cods: Array.from(new Set((input?.cods ?? []).map((c) => String(c).trim()).filter((c) => /^[0-9A-Za-z._-]{1,30}$/.test(c)))).slice(0, 2000),
  }))
  .handler(async ({ data }) => {
    if (!data.cods.length) return { gravados: 0 };
    const { gravarClientesDoErp } = await import("./erp-sync.server");
    return { gravados: await gravarClientesDoErp(data.cods) };
  });
