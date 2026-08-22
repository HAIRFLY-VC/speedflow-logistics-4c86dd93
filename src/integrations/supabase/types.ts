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
          depot_address: string | null
          depot_latitude: number | null
          depot_longitude: number | null
          email: string | null
          id: number
          max_route_value_brl: number
          max_route_weight_kg: number
          phone: string | null
          route_cluster_radius_km: number
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
          depot_address?: string | null
          depot_latitude?: number | null
          depot_longitude?: number | null
          email?: string | null
          id?: number
          max_route_value_brl?: number
          max_route_weight_kg?: number
          phone?: string | null
          route_cluster_radius_km?: number
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
          depot_address?: string | null
          depot_latitude?: number | null
          depot_longitude?: number | null
          email?: string | null
          id?: number
          max_route_value_brl?: number
          max_route_weight_kg?: number
          phone?: string | null
          route_cluster_radius_km?: number
          sla_commercial_approval_hours?: number
          sla_credit_approval_hours?: number
          sla_delivery_hours?: number
          sla_fulfillment_hours?: number
          updated_at?: string
        }
        Relationships: []
      }
      configuracoes_auditoria_frete: {
        Row: {
          created_at: string
          id: number
          tolerancia_percentual: number
          tolerancia_valor: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          tolerancia_percentual?: number
          tolerancia_valor?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          tolerancia_percentual?: number
          tolerancia_valor?: number
          updated_at?: string
        }
        Relationships: []
      }
      configuracoes_erp: {
        Row: {
          api_key: string | null
          created_at: string
          id: number
          updated_at: string
          url_base: string | null
        }
        Insert: {
          api_key?: string | null
          created_at?: string
          id?: number
          updated_at?: string
          url_base?: string | null
        }
        Update: {
          api_key?: string | null
          created_at?: string
          id?: number
          updated_at?: string
          url_base?: string | null
        }
        Relationships: []
      }
      cte_auditorias: {
        Row: {
          created_at: string
          cte_id: string
          detalhamento: Json
          diferenca: number
          id: string
          percentual_diferenca: number
          resultado: Database["public"]["Enums"]["cte_auditoria_resultado"]
          tabela_preco_id: string | null
          tolerancia_aplicada: Json
          valor_cobrado_total: number
          valor_esperado_total: number
        }
        Insert: {
          created_at?: string
          cte_id: string
          detalhamento?: Json
          diferenca?: number
          id?: string
          percentual_diferenca?: number
          resultado: Database["public"]["Enums"]["cte_auditoria_resultado"]
          tabela_preco_id?: string | null
          tolerancia_aplicada?: Json
          valor_cobrado_total?: number
          valor_esperado_total?: number
        }
        Update: {
          created_at?: string
          cte_id?: string
          detalhamento?: Json
          diferenca?: number
          id?: string
          percentual_diferenca?: number
          resultado?: Database["public"]["Enums"]["cte_auditoria_resultado"]
          tabela_preco_id?: string | null
          tolerancia_aplicada?: Json
          valor_cobrado_total?: number
          valor_esperado_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "cte_auditorias_cte_id_fkey"
            columns: ["cte_id"]
            isOneToOne: false
            referencedRelation: "ctes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cte_auditorias_tabela_preco_id_fkey"
            columns: ["tabela_preco_id"]
            isOneToOne: false
            referencedRelation: "tabelas_preco_frete"
            referencedColumns: ["id"]
          },
        ]
      }
      cte_captura_comandos: {
        Row: {
          concluido_em: string | null
          created_at: string
          id: string
          iniciado_em: string | null
          mensagem: string | null
          novos_ctes: number
          reiniciar_nsu: boolean
          solicitado_por: string | null
          status: string
          updated_at: string
        }
        Insert: {
          concluido_em?: string | null
          created_at?: string
          id?: string
          iniciado_em?: string | null
          mensagem?: string | null
          novos_ctes?: number
          reiniciar_nsu?: boolean
          solicitado_por?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          concluido_em?: string | null
          created_at?: string
          id?: string
          iniciado_em?: string | null
          mensagem?: string | null
          novos_ctes?: number
          reiniciar_nsu?: boolean
          solicitado_por?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      cte_divergencias: {
        Row: {
          created_at: string
          cte_id: string
          id: string
          motivo: string
          observacao_operador: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          status: Database["public"]["Enums"]["cte_divergencia_status"]
          updated_at: string
          valor_acordado: number | null
        }
        Insert: {
          created_at?: string
          cte_id: string
          id?: string
          motivo: string
          observacao_operador?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          status?: Database["public"]["Enums"]["cte_divergencia_status"]
          updated_at?: string
          valor_acordado?: number | null
        }
        Update: {
          created_at?: string
          cte_id?: string
          id?: string
          motivo?: string
          observacao_operador?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          status?: Database["public"]["Enums"]["cte_divergencia_status"]
          updated_at?: string
          valor_acordado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cte_divergencias_cte_id_fkey"
            columns: ["cte_id"]
            isOneToOne: false
            referencedRelation: "ctes"
            referencedColumns: ["id"]
          },
        ]
      }
      cte_ingest_logs: {
        Row: {
          chave_acesso: string | null
          cnpj_destinatario: string | null
          cnpj_emitente: string | null
          cnpj_remetente: string | null
          created_at: string
          cte_id: string | null
          id: string
          mensagem: string | null
          nome_remetente: string | null
          origem: Database["public"]["Enums"]["cte_origem_captura"]
          resultado: string
        }
        Insert: {
          chave_acesso?: string | null
          cnpj_destinatario?: string | null
          cnpj_emitente?: string | null
          cnpj_remetente?: string | null
          created_at?: string
          cte_id?: string | null
          id?: string
          mensagem?: string | null
          nome_remetente?: string | null
          origem?: Database["public"]["Enums"]["cte_origem_captura"]
          resultado: string
        }
        Update: {
          chave_acesso?: string | null
          cnpj_destinatario?: string | null
          cnpj_emitente?: string | null
          cnpj_remetente?: string | null
          created_at?: string
          cte_id?: string | null
          id?: string
          mensagem?: string | null
          nome_remetente?: string | null
          origem?: Database["public"]["Enums"]["cte_origem_captura"]
          resultado?: string
        }
        Relationships: [
          {
            foreignKeyName: "cte_ingest_logs_cte_id_fkey"
            columns: ["cte_id"]
            isOneToOne: false
            referencedRelation: "ctes"
            referencedColumns: ["id"]
          },
        ]
      }
      cte_status_historico: {
        Row: {
          alterado_em: string
          alterado_por: string | null
          cte_id: string
          id: string
          observacao: string | null
          status_anterior: Database["public"]["Enums"]["cte_status"] | null
          status_novo: Database["public"]["Enums"]["cte_status"]
        }
        Insert: {
          alterado_em?: string
          alterado_por?: string | null
          cte_id: string
          id?: string
          observacao?: string | null
          status_anterior?: Database["public"]["Enums"]["cte_status"] | null
          status_novo: Database["public"]["Enums"]["cte_status"]
        }
        Update: {
          alterado_em?: string
          alterado_por?: string | null
          cte_id?: string
          id?: string
          observacao?: string | null
          status_anterior?: Database["public"]["Enums"]["cte_status"] | null
          status_novo?: Database["public"]["Enums"]["cte_status"]
        }
        Relationships: [
          {
            foreignKeyName: "cte_status_historico_cte_id_fkey"
            columns: ["cte_id"]
            isOneToOne: false
            referencedRelation: "ctes"
            referencedColumns: ["id"]
          },
        ]
      }
      ctes: {
        Row: {
          chave_acesso: string
          chave_cte_complementado: string | null
          cnpj_destinatario: string | null
          cnpj_emitente: string | null
          componentes: Json
          created_at: string
          data_emissao: string | null
          empresa_id: string | null
          id: string
          motivo_complemento: string | null
          nfs_referenciadas: Json
          nome_destinatario: string | null
          nome_emitente: string | null
          numero: string | null
          numero_cte_complementado: string | null
          observacao: string | null
          observacoes: Json
          origem_captura: Database["public"]["Enums"]["cte_origem_captura"]
          peso_taxado: number | null
          serie: string | null
          status: Database["public"]["Enums"]["cte_status"]
          tipo_cte: number
          tomador_cnpj: string | null
          tomador_nome: string | null
          tomador_papel: Database["public"]["Enums"]["cte_tomador_papel"] | null
          transportadora_id: string | null
          uf_destino: string | null
          updated_at: string
          valor_mercadoria: number
          valor_total_frete: number
          xml_conteudo: string | null
          xml_storage_path: string | null
        }
        Insert: {
          chave_acesso: string
          chave_cte_complementado?: string | null
          cnpj_destinatario?: string | null
          cnpj_emitente?: string | null
          componentes?: Json
          created_at?: string
          data_emissao?: string | null
          empresa_id?: string | null
          id?: string
          motivo_complemento?: string | null
          nfs_referenciadas?: Json
          nome_destinatario?: string | null
          nome_emitente?: string | null
          numero?: string | null
          numero_cte_complementado?: string | null
          observacao?: string | null
          observacoes?: Json
          origem_captura?: Database["public"]["Enums"]["cte_origem_captura"]
          peso_taxado?: number | null
          serie?: string | null
          status?: Database["public"]["Enums"]["cte_status"]
          tipo_cte?: number
          tomador_cnpj?: string | null
          tomador_nome?: string | null
          tomador_papel?:
            | Database["public"]["Enums"]["cte_tomador_papel"]
            | null
          transportadora_id?: string | null
          uf_destino?: string | null
          updated_at?: string
          valor_mercadoria?: number
          valor_total_frete?: number
          xml_conteudo?: string | null
          xml_storage_path?: string | null
        }
        Update: {
          chave_acesso?: string
          chave_cte_complementado?: string | null
          cnpj_destinatario?: string | null
          cnpj_emitente?: string | null
          componentes?: Json
          created_at?: string
          data_emissao?: string | null
          empresa_id?: string | null
          id?: string
          motivo_complemento?: string | null
          nfs_referenciadas?: Json
          nome_destinatario?: string | null
          nome_emitente?: string | null
          numero?: string | null
          numero_cte_complementado?: string | null
          observacao?: string | null
          observacoes?: Json
          origem_captura?: Database["public"]["Enums"]["cte_origem_captura"]
          peso_taxado?: number | null
          serie?: string | null
          status?: Database["public"]["Enums"]["cte_status"]
          tipo_cte?: number
          tomador_cnpj?: string | null
          tomador_nome?: string | null
          tomador_papel?:
            | Database["public"]["Enums"]["cte_tomador_papel"]
            | null
          transportadora_id?: string | null
          uf_destino?: string | null
          updated_at?: string
          valor_mercadoria?: number
          valor_total_frete?: number
          xml_conteudo?: string | null
          xml_storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ctes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctes_transportadora_id_fkey"
            columns: ["transportadora_id"]
            isOneToOne: false
            referencedRelation: "transportadoras"
            referencedColumns: ["id"]
          },
        ]
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
      empresas: {
        Row: {
          ativo: boolean
          cnpj: string
          created_at: string
          id: string
          razao_social: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj: string
          created_at?: string
          id?: string
          razao_social: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string
          created_at?: string
          id?: string
          razao_social?: string
          updated_at?: string
        }
        Relationships: []
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
          transportadora_id: string | null
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
          transportadora_id?: string | null
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
          transportadora_id?: string | null
          updated_at?: string
          user_id?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_carriers_transportadora_id_fkey"
            columns: ["transportadora_id"]
            isOneToOne: false
            referencedRelation: "transportadoras"
            referencedColumns: ["id"]
          },
        ]
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
      nfe_solicitacoes: {
        Row: {
          chave_acesso: string
          created_at: string
          id: string
          mensagem: string | null
          solicitado_por: string | null
          status: Database["public"]["Enums"]["nfe_solicitacao_status"]
          tentativas: number
          updated_at: string
        }
        Insert: {
          chave_acesso: string
          created_at?: string
          id?: string
          mensagem?: string | null
          solicitado_por?: string | null
          status?: Database["public"]["Enums"]["nfe_solicitacao_status"]
          tentativas?: number
          updated_at?: string
        }
        Update: {
          chave_acesso?: string
          created_at?: string
          id?: string
          mensagem?: string | null
          solicitado_por?: string | null
          status?: Database["public"]["Enums"]["nfe_solicitacao_status"]
          tentativas?: number
          updated_at?: string
        }
        Relationships: []
      }
      nfes: {
        Row: {
          chave_acesso: string
          cnpj_destinatario: string | null
          cnpj_emitente: string | null
          created_at: string
          data_emissao: string | null
          especie_volumes: string | null
          id: string
          itens: Json
          natureza_operacao: string | null
          nome_destinatario: string | null
          nome_emitente: string | null
          nsu: number | null
          numero: string | null
          peso_bruto: number | null
          peso_liquido: number | null
          serie: string | null
          uf_destino: string | null
          updated_at: string
          valor_frete: number
          valor_produtos: number
          valor_total: number
          volumes: number | null
          xml_conteudo: string | null
          xml_obtido_em: string | null
          xml_storage_path: string | null
        }
        Insert: {
          chave_acesso: string
          cnpj_destinatario?: string | null
          cnpj_emitente?: string | null
          created_at?: string
          data_emissao?: string | null
          especie_volumes?: string | null
          id?: string
          itens?: Json
          natureza_operacao?: string | null
          nome_destinatario?: string | null
          nome_emitente?: string | null
          nsu?: number | null
          numero?: string | null
          peso_bruto?: number | null
          peso_liquido?: number | null
          serie?: string | null
          uf_destino?: string | null
          updated_at?: string
          valor_frete?: number
          valor_produtos?: number
          valor_total?: number
          volumes?: number | null
          xml_conteudo?: string | null
          xml_obtido_em?: string | null
          xml_storage_path?: string | null
        }
        Update: {
          chave_acesso?: string
          cnpj_destinatario?: string | null
          cnpj_emitente?: string | null
          created_at?: string
          data_emissao?: string | null
          especie_volumes?: string | null
          id?: string
          itens?: Json
          natureza_operacao?: string | null
          nome_destinatario?: string | null
          nome_emitente?: string | null
          nsu?: number | null
          numero?: string | null
          peso_bruto?: number | null
          peso_liquido?: number | null
          serie?: string | null
          uf_destino?: string | null
          updated_at?: string
          valor_frete?: number
          valor_produtos?: number
          valor_total?: number
          volumes?: number | null
          xml_conteudo?: string | null
          xml_obtido_em?: string | null
          xml_storage_path?: string | null
        }
        Relationships: []
      }
      ordens_pagamento_frete: {
        Row: {
          autorizado_em: string | null
          autorizado_por: string | null
          created_at: string
          cte_id: string
          erro_mensagem: string | null
          id: string
          payload_erp_enviado: Json | null
          referencia_erp: string | null
          status: Database["public"]["Enums"]["ordem_pagamento_status"]
          updated_at: string
          valor_autorizado: number
        }
        Insert: {
          autorizado_em?: string | null
          autorizado_por?: string | null
          created_at?: string
          cte_id: string
          erro_mensagem?: string | null
          id?: string
          payload_erp_enviado?: Json | null
          referencia_erp?: string | null
          status?: Database["public"]["Enums"]["ordem_pagamento_status"]
          updated_at?: string
          valor_autorizado?: number
        }
        Update: {
          autorizado_em?: string | null
          autorizado_por?: string | null
          created_at?: string
          cte_id?: string
          erro_mensagem?: string | null
          id?: string
          payload_erp_enviado?: Json | null
          referencia_erp?: string | null
          status?: Database["public"]["Enums"]["ordem_pagamento_status"]
          updated_at?: string
          valor_autorizado?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordens_pagamento_frete_cte_id_fkey"
            columns: ["cte_id"]
            isOneToOne: false
            referencedRelation: "ctes"
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
          cod_agenda: number | null
          created_at: string
          customer_id: string
          delivery_address: string | null
          delivery_latitude: number | null
          delivery_longitude: number | null
          dt_prev_exp: string | null
          erp_id: string | null
          erp_status: string | null
          freight_amount: number
          id: string
          nome_motorista: string | null
          nome_rota: string | null
          notes: string | null
          order_number: string
          qtd_dias: number | null
          salesperson_id: string | null
          sla_deliver_by: string | null
          status: Database["public"]["Enums"]["order_status"]
          status_since: string
          total_amount: number
          updated_at: string
          weight: number | null
        }
        Insert: {
          cod_agenda?: number | null
          created_at?: string
          customer_id: string
          delivery_address?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          dt_prev_exp?: string | null
          erp_id?: string | null
          erp_status?: string | null
          freight_amount?: number
          id?: string
          nome_motorista?: string | null
          nome_rota?: string | null
          notes?: string | null
          order_number: string
          qtd_dias?: number | null
          salesperson_id?: string | null
          sla_deliver_by?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          status_since?: string
          total_amount?: number
          updated_at?: string
          weight?: number | null
        }
        Update: {
          cod_agenda?: number | null
          created_at?: string
          customer_id?: string
          delivery_address?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          dt_prev_exp?: string | null
          erp_id?: string | null
          erp_status?: string | null
          freight_amount?: number
          id?: string
          nome_motorista?: string | null
          nome_rota?: string | null
          notes?: string | null
          order_number?: string
          qtd_dias?: number | null
          salesperson_id?: string | null
          sla_deliver_by?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          status_since?: string
          total_amount?: number
          updated_at?: string
          weight?: number | null
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
          pode_autorizar_pagamento_frete: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          pode_autorizar_pagamento_frete?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          pode_autorizar_pagamento_frete?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      robo_heartbeats: {
        Row: {
          created_at: string
          detalhe: string | null
          origem: string
          ultimo_contato: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          detalhe?: string | null
          origem: string
          ultimo_contato?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          detalhe?: string | null
          origem?: string
          ultimo_contato?: string
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
            isOneToOne: true
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
          driver_name: string | null
          erp_route_id: string | null
          id: string
          notes: string | null
          route_date: string
          status: Database["public"]["Enums"]["route_status"]
          total_distance_km: number | null
          total_freight: number
          updated_at: string
        }
        Insert: {
          carrier_id?: string | null
          code: string
          created_at?: string
          driver_name?: string | null
          erp_route_id?: string | null
          id?: string
          notes?: string | null
          route_date: string
          status?: Database["public"]["Enums"]["route_status"]
          total_distance_km?: number | null
          total_freight?: number
          updated_at?: string
        }
        Update: {
          carrier_id?: string | null
          code?: string
          created_at?: string
          driver_name?: string | null
          erp_route_id?: string | null
          id?: string
          notes?: string | null
          route_date?: string
          status?: Database["public"]["Enums"]["route_status"]
          total_distance_km?: number | null
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
      tabelas_preco_frete: {
        Row: {
          ad_valorem_percentual: number
          arquivo_nome: string | null
          arquivo_path: string | null
          arquivo_tipo: string | null
          ativo: boolean
          codigo_interno: string | null
          created_at: string
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          frete_minimo: number
          gris_minimo: number
          gris_percentual: number
          icms_percentual: number
          id: string
          nome: string
          pedagio_valor: number
          percentual_valor: number
          tas_valor: number
          tipo_calculo: Database["public"]["Enums"]["tabela_frete_tipo_calculo"]
          transportadora_id: string
          uf_destino: string | null
          updated_at: string
        }
        Insert: {
          ad_valorem_percentual?: number
          arquivo_nome?: string | null
          arquivo_path?: string | null
          arquivo_tipo?: string | null
          ativo?: boolean
          codigo_interno?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          descricao?: string | null
          frete_minimo?: number
          gris_minimo?: number
          gris_percentual?: number
          icms_percentual?: number
          id?: string
          nome: string
          pedagio_valor?: number
          percentual_valor?: number
          tas_valor?: number
          tipo_calculo?: Database["public"]["Enums"]["tabela_frete_tipo_calculo"]
          transportadora_id: string
          uf_destino?: string | null
          updated_at?: string
        }
        Update: {
          ad_valorem_percentual?: number
          arquivo_nome?: string | null
          arquivo_path?: string | null
          arquivo_tipo?: string | null
          ativo?: boolean
          codigo_interno?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          frete_minimo?: number
          gris_minimo?: number
          gris_percentual?: number
          icms_percentual?: number
          id?: string
          nome?: string
          pedagio_valor?: number
          percentual_valor?: number
          tas_valor?: number
          tipo_calculo?: Database["public"]["Enums"]["tabela_frete_tipo_calculo"]
          transportadora_id?: string
          uf_destino?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tabelas_preco_frete_transportadora_id_fkey"
            columns: ["transportadora_id"]
            isOneToOne: false
            referencedRelation: "transportadoras"
            referencedColumns: ["id"]
          },
        ]
      }
      tabelas_preco_frete_faixas: {
        Row: {
          created_at: string
          id: string
          peso_ate: number | null
          peso_de: number
          tabela_id: string
          valor_fixo_faixa: number
          valor_por_kg: number
        }
        Insert: {
          created_at?: string
          id?: string
          peso_ate?: number | null
          peso_de?: number
          tabela_id: string
          valor_fixo_faixa?: number
          valor_por_kg?: number
        }
        Update: {
          created_at?: string
          id?: string
          peso_ate?: number | null
          peso_de?: number
          tabela_id?: string
          valor_fixo_faixa?: number
          valor_por_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "tabelas_preco_frete_faixas_tabela_id_fkey"
            columns: ["tabela_id"]
            isOneToOne: false
            referencedRelation: "tabelas_preco_frete"
            referencedColumns: ["id"]
          },
        ]
      }
      tabelas_preco_frete_rotas: {
        Row: {
          created_at: string
          destino: string
          frete_minimo: number
          frete_valor_percentual: number
          id: string
          observacao: string | null
          origem: string
          peso_minimo_kg: number
          prazo_entrega_max_dias: number | null
          prazo_entrega_min_dias: number | null
          tabela_id: string
          tarifa_frete_peso: number
          taxa_despacho: number
          uf_destino: string | null
          uf_origem: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          destino: string
          frete_minimo?: number
          frete_valor_percentual?: number
          id?: string
          observacao?: string | null
          origem: string
          peso_minimo_kg?: number
          prazo_entrega_max_dias?: number | null
          prazo_entrega_min_dias?: number | null
          tabela_id: string
          tarifa_frete_peso?: number
          taxa_despacho?: number
          uf_destino?: string | null
          uf_origem?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          destino?: string
          frete_minimo?: number
          frete_valor_percentual?: number
          id?: string
          observacao?: string | null
          origem?: string
          peso_minimo_kg?: number
          prazo_entrega_max_dias?: number | null
          prazo_entrega_min_dias?: number | null
          tabela_id?: string
          tarifa_frete_peso?: number
          taxa_despacho?: number
          uf_destino?: string | null
          uf_origem?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tabelas_preco_frete_rotas_tabela_id_fkey"
            columns: ["tabela_id"]
            isOneToOne: false
            referencedRelation: "tabelas_preco_frete"
            referencedColumns: ["id"]
          },
        ]
      }
      transportadoras: {
        Row: {
          agencia: string | null
          ativo: boolean
          banco: string | null
          cnpj: string
          cod_erp: string | null
          conta: string | null
          created_at: string
          id: string
          pix: string | null
          razao_social: string
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          cnpj: string
          cod_erp?: string | null
          conta?: string | null
          created_at?: string
          id?: string
          pix?: string | null
          razao_social: string
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          cnpj?: string
          cod_erp?: string | null
          conta?: string | null
          created_at?: string
          id?: string
          pix?: string | null
          razao_social?: string
          updated_at?: string
        }
        Relationships: []
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
      user_table_preferences: {
        Row: {
          preferences: Json
          table_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          preferences?: Json
          table_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          preferences?: Json
          table_key?: string
          updated_at?: string
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
      pode_autorizar_frete: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "adm" | "gestor" | "operador" | "fretista"
      approval_decision: "aprovado" | "reprovado"
      approval_type: "comercial" | "credito"
      cte_auditoria_resultado: "OK" | "DIVERGENTE"
      cte_divergencia_status: "ABERTA" | "EM_NEGOCIACAO" | "RESOLVIDA"
      cte_origem_captura: "MANUAL" | "SEFAZ_AUTO"
      cte_status:
        | "RECEBIDO"
        | "PENDENTE_IDENTIFICACAO"
        | "EM_AUDITORIA"
        | "APROVADO"
        | "DIVERGENTE"
        | "EM_RESOLUCAO"
        | "RESOLVIDO"
        | "AUTORIZADO"
        | "LANCADO_ERP"
        | "ERRO_ERP"
        | "REJEITADO"
      cte_tomador_papel:
        | "REMETENTE"
        | "EXPEDIDOR"
        | "RECEBEDOR"
        | "DESTINATARIO"
        | "OUTROS"
      nfe_solicitacao_status: "PENDENTE" | "PROCESSANDO" | "CONCLUIDA" | "ERRO"
      ordem_pagamento_status:
        | "PENDENTE"
        | "AUTORIZADO"
        | "AGUARDANDO_INTEGRACAO_ERP"
        | "LANCADO_ERP"
        | "ERRO_ERP"
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
      tabela_frete_tipo_calculo: "peso" | "valor"
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
      cte_auditoria_resultado: ["OK", "DIVERGENTE"],
      cte_divergencia_status: ["ABERTA", "EM_NEGOCIACAO", "RESOLVIDA"],
      cte_origem_captura: ["MANUAL", "SEFAZ_AUTO"],
      cte_status: [
        "RECEBIDO",
        "PENDENTE_IDENTIFICACAO",
        "EM_AUDITORIA",
        "APROVADO",
        "DIVERGENTE",
        "EM_RESOLUCAO",
        "RESOLVIDO",
        "AUTORIZADO",
        "LANCADO_ERP",
        "ERRO_ERP",
        "REJEITADO",
      ],
      cte_tomador_papel: [
        "REMETENTE",
        "EXPEDIDOR",
        "RECEBEDOR",
        "DESTINATARIO",
        "OUTROS",
      ],
      nfe_solicitacao_status: ["PENDENTE", "PROCESSANDO", "CONCLUIDA", "ERRO"],
      ordem_pagamento_status: [
        "PENDENTE",
        "AUTORIZADO",
        "AGUARDANDO_INTEGRACAO_ERP",
        "LANCADO_ERP",
        "ERRO_ERP",
      ],
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
      tabela_frete_tipo_calculo: ["peso", "valor"],
    },
  },
} as const
