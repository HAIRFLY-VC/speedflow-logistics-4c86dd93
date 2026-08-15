import type { Database } from "@/integrations/supabase/types";

/**
 * Tipos do banco central (esquema `speedflow`).
 *
 * Reaproveitam os tipos gerados do app e acrescentam o que só existe no
 * central: o vínculo `erp_cod_cliente` (cadastro de clientes vem do ERP) e o
 * cache de coordenadas `customer_geo`.
 */
type Pub = Database["public"];

type OrdersRow = Pub["Tables"]["orders"]["Row"] & {
  erp_cod_cliente: string | null;
};
type OrdersWrite = Omit<Pub["Tables"]["orders"]["Insert"], "customer_id"> & {
  erp_cod_cliente?: string | null;
};

type CustomerGeoRow = {
  cod_cliente: string;
  latitude: number | null;
  longitude: number | null;
  endereco_usado: string | null;
  updated_at: string;
};

export type CentralDatabase = Omit<Database, "public"> & {
  public: Omit<Pub, "Tables"> & {
    Tables: Omit<Pub["Tables"], "orders"> & {
      orders: Omit<Pub["Tables"]["orders"], "Row" | "Insert" | "Update"> & {
        Row: OrdersRow;
        Insert: OrdersWrite;
        Update: Partial<OrdersWrite>;
      };
      customer_geo: {
        Row: CustomerGeoRow;
        Insert: Partial<CustomerGeoRow> & { cod_cliente: string };
        Update: Partial<CustomerGeoRow>;
        Relationships: [];
      };
    };
  };
};
