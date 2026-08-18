import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StatusErpCte } from "@/lib/cte-status-erp.types";

/** Status de contabilização (valores) e de lançamento no financeiro do ERP. */
export const getStatusErpCtes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ cteIds: z.array(z.string().uuid()).max(1000) }).parse(input),
  )
  .handler(async ({ data }): Promise<StatusErpCte[]> => {
    const { statusErpCtes } = await import("./cte-status-erp.server");
    return statusErpCtes(data.cteIds);
  });
