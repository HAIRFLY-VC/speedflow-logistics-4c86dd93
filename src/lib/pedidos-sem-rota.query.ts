import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/central/client";

export const SEM_ROTA_DATE = "4000-01-01";

export type PedidoSemRota = {
  id: string;
  order_number: string | null;
  erp_id: string | null;
  erp_cod_cliente: string | null;
  total_amount: number | null;
  weight: number | null;
  cod_agenda: number | null;
  cod_filial: string | null;
  dt_prev_exp: string | null;
  delivery_address: string | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
};

export const pedidosSemRotaQueryOptions = () =>
  queryOptions({
    queryKey: ["pedidos-sem-rota"],
    queryFn: async () => {
      const pagina = 1000;
      const todos: PedidoSemRota[] = [];

      for (let de = 0; de < 20_000; de += pagina) {
        const { data, error } = await supabase
          .from("orders")
          .select(
            "id, order_number, erp_id, erp_cod_cliente, total_amount, weight, cod_agenda, cod_filial, dt_prev_exp, delivery_address, delivery_latitude, delivery_longitude",
          )
          .or(`dt_prev_exp.is.null,dt_prev_exp.gte.${SEM_ROTA_DATE}`)
          .or("erp_status.is.null,erp_status.neq.11-EXPEDIDO")
          .order("order_number", { ascending: false })
          .range(de, de + pagina - 1);
        if (error) throw error;
        todos.push(...((data ?? []) as PedidoSemRota[]));
        if (!data || data.length < pagina) break;
      }

      return todos;
    },
  });