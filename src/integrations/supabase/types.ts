export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      approvals: {
        Row: {
          approval_type: Database["public"]["Enums"]["approval_type"]
          decided_at: string
          decided_by: string | null
          decision: Database["public"]["Enums"]["approval_decision"]
          id: string
          order_id: string
          reason: string | null
        }
        Insert: {
          approval_type: Database["public"]["Enums"]["approval_type"]
          decided_at?: string
          decided_by?: string | null
          decision: Database["public"]["Enums"]["approval_decision"]
          id?: string
          order_id: string
          reason?: string | null
        }
        Update: {
          approval_type?: Database["public"]["Enums"]["approval_type"]
          decided_at?: string
          decided_by?: string | null
          decision?: Database["public"]["Enums"]["approval_decision"]
          id?: string
          order_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approvals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          auto_approve_below: number
          cnpj: string | null
          commercial_approval_threshold: number
          company_name: string
          created_at: string
          credit_approval_threshold: number
          email: string | null
          id: number
          phone: string | null
          sla_commercial_approval_hours: number
          sla_credit_approval_hours: number
          sla_delivery_hours: number
          sla_fulfillment_hours: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          auto_approve_below?: number
          cnpj?: string | null
          commercial_approval_threshold?: number
          company_name?: string
          created_at?: string
          credit_approval_threshold?: number
          email?: string | null
          id?: number
          phone?: string | null
          sla_commercial_approval_hours?: number
          sla_credit_approval_hours?: number
          sla_delivery_hours?: number
          sla_fulfillment_hours?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          auto_approve_below?: number
          cnpj?: string | null
          commercial_approval_threshold?: number
          company_name?: string
          created_at?: string
          credit_approval_threshold?: number
          email?: string | null
          id?: number
          phone?: string | null
          sla_commercial_approval_hours?: number
          sla_credit_approval_hours?: number
          sla_delivery_hours?: number
          sla_fulfillment_hours?: number
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address_line: string | null
          city: string | null
          cnpj: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          erp_id: string | null
          id: string
          is_active: boolean
          latitude: number | null
          legal_name: string
          longitude: number | null
          notes: string | null
          phone: string | null
          state: string | null
          trade_name: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address_line?: string | null
          city?: string | null
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          erp_id?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          legal_name: string
          longitude?: number | null
          notes?: string | null
          phone?: string | null
          state?: string | null
          trade_name?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address_line?: string | null
          city?: string | null
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          erp_id?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          legal_name?: string
          longitude?: number | null
          notes?: string | null
          phone?: string | null
          state?: string | null
          trade_name?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          created_at: string
          delivered_at: string
          id: string
          notes: string | null
          order_id: string
          received_by_document: string | null
          received_by_name: string | null
        }
        Insert: {
          created_at?: string
          delivered_at?: string
          id?: string
          notes?: string | null
          order_id: string
          received_by_document?: string | null
          received_by_name?: string | null
        }
        Update: {
          created_at?: string
          delivered_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          received_by_document?: string | null
          received_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_manifests: {
        Row: {
          code: string
          created_at: string
          id: string
          issued_at: string
          issued_by: string | null
          notes: string | null
          route_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          notes?: string | null
          route_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          notes?: string | null
          route_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_manifests_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: true
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_receipts: {
        Row: {
          created_at: string
          delivery_id: string
          id: string
          photo_url: string | null
          signature_url: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          delivery_id: string
          id?: string
          photo_url?: string | null
          signature_url?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          delivery_id?: string
          id?: string
          photo_url?: string | null
          signature_url?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_receipts_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_sync_runs: {
        Row: {
          customers_created: number
          errors: Json
          finished_at: string | null
          id: string
          orders_created: number
          orders_fetched: number
          orders_skipped: number
          orders_updated: number
          started_at: string
          status: string
          trigger: string
          triggered_by: string | null
        }
        Insert: {
          customers_created?: number
          errors?: Json
          finished_at?: string | null
          id?: string
          orders_created?: number
          orders_fetched?: number
          orders_skipped?: number
          orders_updated?: number
          started_at?: string
          status?: string
          trigger: string
          triggered_by?: string | null
        }
        Update: {
          customers_created?: number
          errors?: Json
          finished_at?: string | null
          id?: string
          orders_created?: number
          orders_fetched?: number
          orders_skipped?: number
          orders_updated?: number
          started_at?: string
          status?: string
          trigger?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      freight_carriers: {
        Row: {
          created_at: string
          document: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
          user_id: string | null
          vehicle_plate: string | null
          vehicle_type: string | null
        }
        Insert: {
          created_at?: string
          document?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string | null
        }
        Update: {
          created_at?: string
          document?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          boleto_url: string | null
          created_at: string
          id: string
          issued_at: string
          issued_by: string | null
          nfe_key: string | null
          nfe_number: string | null
          order_id: string
          updated_at: string
        }
        Insert: {
          boleto_url?: string | null
          created_at?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          nfe_key?: string | null
          nfe_number?: string | null
          order_id: string
          updated_at?: string
        }
        Update: {
          boleto_url?: string | null
          created_at?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          nfe_key?: string | null
          nfe_number?: string | null
          order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: string
          note: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          note?: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          note?: string | null
          order_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string
          dt_prev_exp: string | null
          erp_id: string | null
          freight_amount: number
          id: string
          nome_motorista: string | null
          nome_rota: string | null
          notes: string | null
          order_number: string
          salesperson_id: string | null
          sla_deliver_by: string | null
          status: Database["public"]["Enums"]["order_status"]
          status_since: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          dt_prev_exp?: string | null
          erp_id?: string | null
          freight_amount?: number
          id?: string
          nome_motorista?: string | null
          nome_rota?: string | null
          notes?: string | null
          order_number: string
          salesperson_id?: string | null
          sla_deliver_by?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          status_since?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          dt_prev_exp?: string | null
          erp_id?: string | null
          freight_amount?: number
          id?: string
          nome_motorista?: string | null
          nome_rota?: string | null
          notes?: string | null
          order_number?: string
          salesperson_id?: string | null
          sla_deliver_by?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          status_since?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      picking_tasks: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          notes: string | null
          order_id: string
          picker_id: string | null
          started_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          order_id: string
          picker_id?: string | null
          started_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          picker_id?: string | null
          started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "picking_tasks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          erp_id: string | null
          id: string
          is_active: boolean
          name: string
          sku: string
          stock_qty: number
          unit_price: number
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          erp_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          sku: string
          stock_qty?: number
          unit_price?: number
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          erp_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sku?: string
          stock_qty?: number
          unit_price?: number
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      route_orders: {
        Row: {
          created_at: string
          id: string
          order_id: string
          route_id: string
          stop_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          route_id: string
          stop_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          route_id?: string
          stop_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "route_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_orders_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          carrier_id: string | null
          code: string
          created_at: string
          id: string
          notes: string | null
          route_date: string
          status: Database["public"]["Enums"]["route_status"]
          total_freight: number
          updated_at: string
        }
        Insert: {
          carrier_id?: string | null
          code: string
          created_at?: string
          id?: string
          notes?: string | null
          route_date: string
          status?: Database["public"]["Enums"]["route_status"]
          total_freight?: number
          updated_at?: string
        }
        Update: {
          carrier_id?: string | null
          code?: string
          created_at?: string
          id?: string
          notes?: string | null
          route_date?: string
          status?: Database["public"]["Enums"]["route_status"]
          total_freight?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "freight_carriers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      order_belongs_to_carrier: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "adm" | "gestor" | "operador" | "fretista"
      approval_decision: "aprovado" | "reprovado"
      approval_type: "comercial" | "credito"
      order_status:
        | "aguardando_aprovacao_comercial"
        | "aguardando_aprovacao_credito"
        | "aguardando_faturamento"
        | "em_separacao"
        | "aguardando_roteirizacao"
        | "faturado"
        | "em_transporte"
        | "entregue"
        | "reprovado_comercial"
        | "reprovado_credito"
        | "cancelado"
      route_status: "planejada" | "em_andamento" | "concluida" | "cancelada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["adm", "gestor", "operador", "fretista"],
      approval_decision: ["aprovado", "reprovado"],
      approval_type: ["comercial", "credito"],
      order_status: [
        "aguardando_aprovacao_comercial",
        "aguardando_aprovacao_credito",
        "aguardando_faturamento",
        "em_separacao",
        "aguardando_roteirizacao",
        "faturado",
        "em_transporte",
        "entregue",
        "reprovado_comercial",
        "reprovado_credito",
        "cancelado",
      ],
      route_status: ["planejada", "em_andamento", "concluida", "cancelada"],
    },
  },
} as const
