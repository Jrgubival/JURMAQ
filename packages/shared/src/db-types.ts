export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      account_erasure_log: {
        Row: {
          carrito_borrado: number | null
          cotizaciones_anonimizadas: number | null
          email_anonimo: string
          erased_at: string
          id: number
          ip: string | null
          suscripcion_borrada: boolean | null
          user_agent: string | null
          user_id: number
        }
        Insert: {
          carrito_borrado?: number | null
          cotizaciones_anonimizadas?: number | null
          email_anonimo: string
          erased_at?: string
          id?: number
          ip?: string | null
          suscripcion_borrada?: boolean | null
          user_agent?: string | null
          user_id: number
        }
        Update: {
          carrito_borrado?: number | null
          cotizaciones_anonimizadas?: number | null
          email_anonimo?: string
          erased_at?: string
          id?: number
          ip?: string | null
          suscripcion_borrada?: boolean | null
          user_agent?: string | null
          user_id?: number
        }
        Relationships: []
      }
      admin_emails_log: {
        Row: {
          asunto: string
          contrato_id: number | null
          cotizacion_arriendo_id: number | null
          custom_message: string | null
          email_provider_id: string | null
          email_status: string
          id: string
          kind: string
          sent_at: string
          sent_by_email: string | null
          sent_by_user_id: string
          solicitud_id: number | null
          to_email: string
          to_nombre: string | null
        }
        Insert: {
          asunto: string
          contrato_id?: number | null
          cotizacion_arriendo_id?: number | null
          custom_message?: string | null
          email_provider_id?: string | null
          email_status?: string
          id?: string
          kind: string
          sent_at?: string
          sent_by_email?: string | null
          sent_by_user_id: string
          solicitud_id?: number | null
          to_email: string
          to_nombre?: string | null
        }
        Update: {
          asunto?: string
          contrato_id?: number | null
          cotizacion_arriendo_id?: number | null
          custom_message?: string | null
          email_provider_id?: string | null
          email_status?: string
          id?: string
          kind?: string
          sent_at?: string
          sent_by_email?: string | null
          sent_by_user_id?: string
          solicitud_id?: number | null
          to_email?: string
          to_nombre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_emails_log_cotizacion_arriendo_id_fkey"
            columns: ["cotizacion_arriendo_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones_arriendo"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          ref_id: string | null
          ref_type: string | null
          severity: string
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          ref_id?: string | null
          ref_type?: string | null
          severity?: string
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          ref_id?: string | null
          ref_type?: string | null
          severity?: string
          title?: string
        }
        Relationships: []
      }
      admin_notifications_reads: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notifications_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "admin_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      asistente_consent_log: {
        Row: {
          accepted_at: string
          consent_id: string
          id: number
          ip_hash: string
          user_agent_hash: string | null
        }
        Insert: {
          accepted_at?: string
          consent_id: string
          id?: number
          ip_hash: string
          user_agent_hash?: string | null
        }
        Update: {
          accepted_at?: string
          consent_id?: string
          id?: number
          ip_hash?: string
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      barraca_carrito: {
        Row: {
          cantidad: number
          created_at: string
          id: number
          precio_unitario: number | null
          producto_id: number
          session_id: string
          usuario_id: number | null
        }
        Insert: {
          cantidad?: number
          created_at?: string
          id?: number
          precio_unitario?: number | null
          producto_id: number
          session_id: string
          usuario_id?: number | null
        }
        Update: {
          cantidad?: number
          created_at?: string
          id?: number
          precio_unitario?: number | null
          producto_id?: number
          session_id?: string
          usuario_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "barraca_carrito_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "barraca_productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barraca_carrito_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "barraca_productos_public"
            referencedColumns: ["id"]
          },
        ]
      }
      barraca_carrito_abandonado: {
        Row: {
          converted_at: string | null
          created_at: string
          cupon_generado: string | null
          email: string
          id: string
          items: Json
          last_activity: string
          recovery_count: number
          recovery_last_at: string | null
          session_id: string | null
          sms_recovery_sent_at: string | null
          telefono: string | null
          total: number
          usuario_id: number | null
        }
        Insert: {
          converted_at?: string | null
          created_at?: string
          cupon_generado?: string | null
          email: string
          id?: string
          items: Json
          last_activity?: string
          recovery_count?: number
          recovery_last_at?: string | null
          session_id?: string | null
          sms_recovery_sent_at?: string | null
          telefono?: string | null
          total: number
          usuario_id?: number | null
        }
        Update: {
          converted_at?: string | null
          created_at?: string
          cupon_generado?: string | null
          email?: string
          id?: string
          items?: Json
          last_activity?: string
          recovery_count?: number
          recovery_last_at?: string | null
          session_id?: string | null
          sms_recovery_sent_at?: string | null
          telefono?: string | null
          total?: number
          usuario_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "barraca_carrito_abandonado_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "barraca_usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      barraca_categorias: {
        Row: {
          activa: boolean
          created_at: string
          descripcion: string | null
          id: number
          imagen: string | null
          nombre: string
          orden: number | null
          padre_id: number | null
          slug: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          descripcion?: string | null
          id?: number
          imagen?: string | null
          nombre: string
          orden?: number | null
          padre_id?: number | null
          slug: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          descripcion?: string | null
          id?: number
          imagen?: string | null
          nombre?: string
          orden?: number | null
          padre_id?: number | null
          slug?: string
        }
        Relationships: []
      }
      barraca_cotizaciones: {
        Row: {
          accept_token: string | null
          accept_token_used_at: string | null
          codigo_maestro: string | null
          contraoferta_items: string | null
          contraoferta_mensaje: string | null
          contraoferta_total: number | null
          cotizacion_competencia: string | null
          created_at: string
          email: string
          empresa: string | null
          estado: string
          id: number
          items: string
          maestro_id: string | null
          metodo_pago: string | null
          nombre: string
          nombre_competencia: string | null
          notas: string | null
          numero: string
          pagada_at: string | null
          payment_url: string | null
          purchase_thanks_sent_at: string | null
          replenishment_sent_at: string | null
          review_request_sent_at: string | null
          rut: string | null
          telefono: string
          total: number
          usuario_id: number | null
        }
        Insert: {
          accept_token?: string | null
          accept_token_used_at?: string | null
          codigo_maestro?: string | null
          contraoferta_items?: string | null
          contraoferta_mensaje?: string | null
          contraoferta_total?: number | null
          cotizacion_competencia?: string | null
          created_at?: string
          email: string
          empresa?: string | null
          estado?: string
          id?: number
          items: string
          maestro_id?: string | null
          metodo_pago?: string | null
          nombre: string
          nombre_competencia?: string | null
          notas?: string | null
          numero: string
          pagada_at?: string | null
          payment_url?: string | null
          purchase_thanks_sent_at?: string | null
          replenishment_sent_at?: string | null
          review_request_sent_at?: string | null
          rut?: string | null
          telefono: string
          total?: number
          usuario_id?: number | null
        }
        Update: {
          accept_token?: string | null
          accept_token_used_at?: string | null
          codigo_maestro?: string | null
          contraoferta_items?: string | null
          contraoferta_mensaje?: string | null
          contraoferta_total?: number | null
          cotizacion_competencia?: string | null
          created_at?: string
          email?: string
          empresa?: string | null
          estado?: string
          id?: number
          items?: string
          maestro_id?: string | null
          metodo_pago?: string | null
          nombre?: string
          nombre_competencia?: string | null
          notas?: string | null
          numero?: string
          pagada_at?: string | null
          payment_url?: string | null
          purchase_thanks_sent_at?: string | null
          replenishment_sent_at?: string | null
          review_request_sent_at?: string | null
          rut?: string | null
          telefono?: string
          total?: number
          usuario_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "barraca_cotizaciones_maestro_id_fkey"
            columns: ["maestro_id"]
            isOneToOne: false
            referencedRelation: "maestros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barraca_cotizaciones_maestro_id_fkey"
            columns: ["maestro_id"]
            isOneToOne: false
            referencedRelation: "maestros_public"
            referencedColumns: ["id"]
          },
        ]
      }
      barraca_precio_historial: {
        Row: {
          changed_by: string | null
          id: number
          motivo: string | null
          precio: number
          producto_id: number
          vigente_desde: string
          vigente_hasta: string | null
        }
        Insert: {
          changed_by?: string | null
          id?: number
          motivo?: string | null
          precio: number
          producto_id: number
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Update: {
          changed_by?: string | null
          id?: number
          motivo?: string | null
          precio?: number
          producto_id?: number
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barraca_precio_historial_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "barraca_productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barraca_precio_historial_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "barraca_productos_public"
            referencedColumns: ["id"]
          },
        ]
      }
      barraca_productos: {
        Row: {
          activo: boolean
          categoria_id: number | null
          codigo: string | null
          costo: number | null
          created_at: string
          descripcion: string | null
          destacado: boolean | null
          en_oferta: boolean | null
          id: number
          imagen: string | null
          medida: string | null
          nombre: string
          oferta_fin: string | null
          peso: number | null
          precio: number
          precio_original: number | null
          producto_padre_id: number | null
          slug: string
          solo_cotizar: boolean | null
          stock: number | null
          unidad: string | null
        }
        Insert: {
          activo?: boolean
          categoria_id?: number | null
          codigo?: string | null
          costo?: number | null
          created_at?: string
          descripcion?: string | null
          destacado?: boolean | null
          en_oferta?: boolean | null
          id?: number
          imagen?: string | null
          medida?: string | null
          nombre: string
          oferta_fin?: string | null
          peso?: number | null
          precio?: number
          precio_original?: number | null
          producto_padre_id?: number | null
          slug: string
          solo_cotizar?: boolean | null
          stock?: number | null
          unidad?: string | null
        }
        Update: {
          activo?: boolean
          categoria_id?: number | null
          codigo?: string | null
          costo?: number | null
          created_at?: string
          descripcion?: string | null
          destacado?: boolean | null
          en_oferta?: boolean | null
          id?: number
          imagen?: string | null
          medida?: string | null
          nombre?: string
          oferta_fin?: string | null
          peso?: number | null
          precio?: number
          precio_original?: number | null
          producto_padre_id?: number | null
          slug?: string
          solo_cotizar?: boolean | null
          stock?: number | null
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barraca_productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "barraca_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      barraca_promociones: {
        Row: {
          activa: boolean
          categoria_id: number | null
          created_at: string
          descripcion: string | null
          descuento_porcentaje: number
          fecha_fin: string | null
          fecha_inicio: string | null
          id: number
          imagen: string | null
          titulo: string
        }
        Insert: {
          activa?: boolean
          categoria_id?: number | null
          created_at?: string
          descripcion?: string | null
          descuento_porcentaje?: number
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: number
          imagen?: string | null
          titulo: string
        }
        Update: {
          activa?: boolean
          categoria_id?: number | null
          created_at?: string
          descripcion?: string | null
          descuento_porcentaje?: number
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: number
          imagen?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "barraca_promociones_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "barraca_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      barraca_reviews: {
        Row: {
          comentario: string | null
          compra_verificada: boolean
          created_at: string
          estado: string
          id: string
          moderado_at: string | null
          moderado_by: string | null
          notas_moderacion: string | null
          producto_id: number
          rating: number
          titulo: string | null
          usuario_id: number
          usuario_nombre: string
          utiles_count: number
        }
        Insert: {
          comentario?: string | null
          compra_verificada?: boolean
          created_at?: string
          estado?: string
          id?: string
          moderado_at?: string | null
          moderado_by?: string | null
          notas_moderacion?: string | null
          producto_id: number
          rating: number
          titulo?: string | null
          usuario_id: number
          usuario_nombre: string
          utiles_count?: number
        }
        Update: {
          comentario?: string | null
          compra_verificada?: boolean
          created_at?: string
          estado?: string
          id?: string
          moderado_at?: string | null
          moderado_by?: string | null
          notas_moderacion?: string | null
          producto_id?: number
          rating?: number
          titulo?: string | null
          usuario_id?: number
          usuario_nombre?: string
          utiles_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "barraca_reviews_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "barraca_productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barraca_reviews_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "barraca_productos_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barraca_reviews_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "barraca_usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      barraca_reviews_likes: {
        Row: {
          created_at: string
          id: string
          review_id: string
          usuario_id: number
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          usuario_id: number
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          usuario_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "barraca_reviews_likes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "barraca_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barraca_reviews_likes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "barraca_usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      barraca_suscriptores: {
        Row: {
          activo: boolean
          created_at: string
          email: string
          id: number
          nombre: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          email: string
          id?: number
          nombre?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          email?: string
          id?: number
          nombre?: string | null
        }
        Relationships: []
      }
      barraca_usuarios: {
        Row: {
          activo: boolean
          created_at: string
          email: string
          empresa: string | null
          id: number
          nombre: string
          password: string
          rol: string
          rut: string | null
          telefono: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          email: string
          empresa?: string | null
          id?: number
          nombre: string
          password: string
          rol?: string
          rut?: string | null
          telefono?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          email?: string
          empresa?: string | null
          id?: number
          nombre?: string
          password?: string
          rol?: string
          rut?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      bloqueos_maquinaria: {
        Row: {
          categoria: string
          contrato_id: number | null
          cotizacion_arriendo_id: number | null
          created_at: string
          created_by: number | null
          fecha_fin: string
          fecha_inicio: string
          id: number
          maquinaria_id: number
          motivo: string
          updated_at: string
        }
        Insert: {
          categoria?: string
          contrato_id?: number | null
          cotizacion_arriendo_id?: number | null
          created_at?: string
          created_by?: number | null
          fecha_fin: string
          fecha_inicio: string
          id?: number
          maquinaria_id: number
          motivo: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          contrato_id?: number | null
          cotizacion_arriendo_id?: number | null
          created_at?: string
          created_by?: number | null
          fecha_fin?: string
          fecha_inicio?: string
          id?: number
          maquinaria_id?: number
          motivo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bloqueos_maquinaria_cotizacion_arriendo_id_fkey"
            columns: ["cotizacion_arriendo_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones_arriendo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bloqueos_maquinaria_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bloqueos_maquinaria_maquinaria_id_fkey"
            columns: ["maquinaria_id"]
            isOneToOne: false
            referencedRelation: "maquinarias"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          created_at: string
          direccion: string | null
          email: string | null
          empresa: string | null
          id: number
          nombre: string
          notas: string | null
          rut: string | null
          telefono: string | null
        }
        Insert: {
          created_at?: string
          direccion?: string | null
          email?: string | null
          empresa?: string | null
          id?: number
          nombre: string
          notas?: string | null
          rut?: string | null
          telefono?: string | null
        }
        Update: {
          created_at?: string
          direccion?: string | null
          email?: string | null
          empresa?: string | null
          id?: number
          nombre?: string
          notas?: string | null
          rut?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      combustible_facturas: {
        Row: {
          archivo_nombre: string | null
          archivo_tamano: number | null
          archivo_url: string | null
          created_at: string
          created_by_user_id: number | null
          estado: string
          f29_fecha_presentacion: string | null
          f29_folio: string | null
          f29_periodo_tributario: string | null
          fecha: string
          folio: string
          id: number
          mes_tributario: string | null
          monto_iec: number | null
          monto_iva: number | null
          monto_neto: number | null
          monto_total: number
          notas: string | null
          proveedor_direccion: string | null
          proveedor_nombre: string
          proveedor_rut: string | null
          recuperable: boolean
          tipo_documento: string
          updated_at: string
          utm_mes_aplicada: number | null
        }
        Insert: {
          archivo_nombre?: string | null
          archivo_tamano?: number | null
          archivo_url?: string | null
          created_at?: string
          created_by_user_id?: number | null
          estado?: string
          f29_fecha_presentacion?: string | null
          f29_folio?: string | null
          f29_periodo_tributario?: string | null
          fecha: string
          folio: string
          id?: number
          mes_tributario?: string | null
          monto_iec?: number | null
          monto_iva?: number | null
          monto_neto?: number | null
          monto_total: number
          notas?: string | null
          proveedor_direccion?: string | null
          proveedor_nombre: string
          proveedor_rut?: string | null
          recuperable?: boolean
          tipo_documento?: string
          updated_at?: string
          utm_mes_aplicada?: number | null
        }
        Update: {
          archivo_nombre?: string | null
          archivo_tamano?: number | null
          archivo_url?: string | null
          created_at?: string
          created_by_user_id?: number | null
          estado?: string
          f29_fecha_presentacion?: string | null
          f29_folio?: string | null
          f29_periodo_tributario?: string | null
          fecha?: string
          folio?: string
          id?: number
          mes_tributario?: string | null
          monto_iec?: number | null
          monto_iva?: number | null
          monto_neto?: number | null
          monto_total?: number
          notas?: string | null
          proveedor_direccion?: string | null
          proveedor_nombre?: string
          proveedor_rut?: string | null
          recuperable?: boolean
          tipo_documento?: string
          updated_at?: string
          utm_mes_aplicada?: number | null
        }
        Relationships: []
      }
      combustible_items: {
        Row: {
          contrato_id: number | null
          created_at: string
          factura_id: number
          horometro: number | null
          id: number
          litros: number
          maquinaria_id: number | null
          monto: number
          observaciones: string | null
          odometro: number | null
          precio_por_litro: number | null
          tipo_combustible: string
        }
        Insert: {
          contrato_id?: number | null
          created_at?: string
          factura_id: number
          horometro?: number | null
          id?: number
          litros: number
          maquinaria_id?: number | null
          monto: number
          observaciones?: string | null
          odometro?: number | null
          precio_por_litro?: number | null
          tipo_combustible: string
        }
        Update: {
          contrato_id?: number | null
          created_at?: string
          factura_id?: number
          horometro?: number | null
          id?: number
          litros?: number
          maquinaria_id?: number | null
          monto?: number
          observaciones?: string | null
          odometro?: number | null
          precio_por_litro?: number | null
          tipo_combustible?: string
        }
        Relationships: [
          {
            foreignKeyName: "combustible_items_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combustible_items_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "combustible_facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combustible_items_maquinaria_id_fkey"
            columns: ["maquinaria_id"]
            isOneToOne: false
            referencedRelation: "maquinarias"
            referencedColumns: ["id"]
          },
        ]
      }
      combustible_tarifas_iec: {
        Row: {
          componente_fijo_clp_litro: number
          componente_variable_utm_m3: number | null
          created_at: string
          created_by: string | null
          decreto_supremo: string | null
          id: number
          notas: string | null
          tipo_combustible: string
          utm_referencia_clp: number | null
          vigente_desde: string
          vigente_hasta: string | null
        }
        Insert: {
          componente_fijo_clp_litro: number
          componente_variable_utm_m3?: number | null
          created_at?: string
          created_by?: string | null
          decreto_supremo?: string | null
          id?: number
          notas?: string | null
          tipo_combustible: string
          utm_referencia_clp?: number | null
          vigente_desde: string
          vigente_hasta?: string | null
        }
        Update: {
          componente_fijo_clp_litro?: number
          componente_variable_utm_m3?: number | null
          created_at?: string
          created_by?: string | null
          decreto_supremo?: string | null
          id?: number
          notas?: string | null
          tipo_combustible?: string
          utm_referencia_clp?: number | null
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Relationships: []
      }
      comisiones_maestro: {
        Row: {
          created_at: string
          devengada_at: string | null
          estado: string
          id: string
          maestro_id: string
          monto_comision: number
          monto_venta_neto: number
          notas: string | null
          origen_id: string
          origen_tipo: string
          pagada_at: string | null
          pagada_by: string | null
          pago_referencia: string | null
          porcentaje: number
        }
        Insert: {
          created_at?: string
          devengada_at?: string | null
          estado?: string
          id?: string
          maestro_id: string
          monto_comision: number
          monto_venta_neto: number
          notas?: string | null
          origen_id: string
          origen_tipo: string
          pagada_at?: string | null
          pagada_by?: string | null
          pago_referencia?: string | null
          porcentaje: number
        }
        Update: {
          created_at?: string
          devengada_at?: string | null
          estado?: string
          id?: string
          maestro_id?: string
          monto_comision?: number
          monto_venta_neto?: number
          notas?: string | null
          origen_id?: string
          origen_tipo?: string
          pagada_at?: string | null
          pagada_by?: string | null
          pago_referencia?: string | null
          porcentaje?: number
        }
        Relationships: [
          {
            foreignKeyName: "comisiones_maestro_maestro_id_fkey"
            columns: ["maestro_id"]
            isOneToOne: false
            referencedRelation: "maestros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comisiones_maestro_maestro_id_fkey"
            columns: ["maestro_id"]
            isOneToOne: false
            referencedRelation: "maestros_public"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          arrendatario_domicilio: string
          arrendatario_email: string
          arrendatario_giro: string | null
          arrendatario_nombre: string | null
          arrendatario_profesion: string | null
          arrendatario_razon_social: string | null
          arrendatario_rep_legal: string | null
          arrendatario_rep_rut: string | null
          arrendatario_rut: string
          arrendatario_telefono: string
          arrendatario_tipo: string
          cedula_hash: string | null
          cedula_url: string | null
          con_operador: boolean
          created_at: string
          created_by_user_id: number | null
          direccion_entrega: string
          direccion_retiro: string | null
          estado: string
          fecha_inicio: string
          fecha_termino: string
          firma_arrendador: string | null
          firma_arrendador_at: string | null
          firma_arrendador_nombre: string | null
          firma_arrendador_user_id: number | null
          firma_arrendatario: string | null
          firma_ciudad: string | null
          firma_hash: string | null
          firma_ip: string | null
          firma_otp_verified: boolean | null
          firma_pais: string | null
          firma_region: string | null
          firma_timestamp: string | null
          firma_token: string | null
          firma_token_expira_at: string | null
          firma_user_agent: string | null
          garantia_monto: number
          id: number
          identidad_subida_at: string | null
          maquinaria_id: number | null
          notas_internas: string | null
          numero: string
          observaciones: string | null
          operador_nombre: string | null
          pdf_url: string | null
          precio_por_unidad: number
          precio_total: number
          precio_unidad: string
          rut_verified: string | null
          template_id: number | null
          updated_at: string
        }
        Insert: {
          arrendatario_domicilio: string
          arrendatario_email: string
          arrendatario_giro?: string | null
          arrendatario_nombre?: string | null
          arrendatario_profesion?: string | null
          arrendatario_razon_social?: string | null
          arrendatario_rep_legal?: string | null
          arrendatario_rep_rut?: string | null
          arrendatario_rut: string
          arrendatario_telefono: string
          arrendatario_tipo: string
          cedula_hash?: string | null
          cedula_url?: string | null
          con_operador?: boolean
          created_at?: string
          created_by_user_id?: number | null
          direccion_entrega: string
          direccion_retiro?: string | null
          estado?: string
          fecha_inicio: string
          fecha_termino: string
          firma_arrendador?: string | null
          firma_arrendador_at?: string | null
          firma_arrendador_nombre?: string | null
          firma_arrendador_user_id?: number | null
          firma_arrendatario?: string | null
          firma_ciudad?: string | null
          firma_hash?: string | null
          firma_ip?: string | null
          firma_otp_verified?: boolean | null
          firma_pais?: string | null
          firma_region?: string | null
          firma_timestamp?: string | null
          firma_token?: string | null
          firma_token_expira_at?: string | null
          firma_user_agent?: string | null
          garantia_monto?: number
          id?: number
          identidad_subida_at?: string | null
          maquinaria_id?: number | null
          notas_internas?: string | null
          numero: string
          observaciones?: string | null
          operador_nombre?: string | null
          pdf_url?: string | null
          precio_por_unidad: number
          precio_total: number
          precio_unidad: string
          rut_verified?: string | null
          template_id?: number | null
          updated_at?: string
        }
        Update: {
          arrendatario_domicilio?: string
          arrendatario_email?: string
          arrendatario_giro?: string | null
          arrendatario_nombre?: string | null
          arrendatario_profesion?: string | null
          arrendatario_razon_social?: string | null
          arrendatario_rep_legal?: string | null
          arrendatario_rep_rut?: string | null
          arrendatario_rut?: string
          arrendatario_telefono?: string
          arrendatario_tipo?: string
          cedula_hash?: string | null
          cedula_url?: string | null
          con_operador?: boolean
          created_at?: string
          created_by_user_id?: number | null
          direccion_entrega?: string
          direccion_retiro?: string | null
          estado?: string
          fecha_inicio?: string
          fecha_termino?: string
          firma_arrendador?: string | null
          firma_arrendador_at?: string | null
          firma_arrendador_nombre?: string | null
          firma_arrendador_user_id?: number | null
          firma_arrendatario?: string | null
          firma_ciudad?: string | null
          firma_hash?: string | null
          firma_ip?: string | null
          firma_otp_verified?: boolean | null
          firma_pais?: string | null
          firma_region?: string | null
          firma_timestamp?: string | null
          firma_token?: string | null
          firma_token_expira_at?: string | null
          firma_user_agent?: string | null
          garantia_monto?: number
          id?: number
          identidad_subida_at?: string | null
          maquinaria_id?: number | null
          notas_internas?: string | null
          numero?: string
          observaciones?: string | null
          operador_nombre?: string | null
          pdf_url?: string | null
          precio_por_unidad?: number
          precio_total?: number
          precio_unidad?: string
          rut_verified?: string | null
          template_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratos_firma_arrendador_user_id_fkey"
            columns: ["firma_arrendador_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_maquinaria_id_fkey"
            columns: ["maquinaria_id"]
            isOneToOne: false
            referencedRelation: "maquinarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contratos_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_audit_log: {
        Row: {
          ciudad: string | null
          contrato_id: number
          event_at: string
          event_type: string
          id: number
          ip: string | null
          metadata: Json | null
          pais: string | null
          region: string | null
          user_agent: string | null
        }
        Insert: {
          ciudad?: string | null
          contrato_id: number
          event_at?: string
          event_type: string
          id?: number
          ip?: string | null
          metadata?: Json | null
          pais?: string | null
          region?: string | null
          user_agent?: string | null
        }
        Update: {
          ciudad?: string | null
          contrato_id?: number
          event_at?: string
          event_type?: string
          id?: number
          ip?: string | null
          metadata?: Json | null
          pais?: string | null
          region?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_audit_log_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_otp: {
        Row: {
          codigo: string
          contrato_id: number | null
          created_at: string
          expires_at: string
          id: number
          intentos: number
          telefono: string
          verificado: boolean
        }
        Insert: {
          codigo: string
          contrato_id?: number | null
          created_at?: string
          expires_at: string
          id?: number
          intentos?: number
          telefono: string
          verificado?: boolean
        }
        Update: {
          codigo?: string
          contrato_id?: number | null
          created_at?: string
          expires_at?: string
          id?: number
          intentos?: number
          telefono?: string
          verificado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "contratos_otp_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_templates: {
        Row: {
          activo: boolean
          contenido: string
          created_at: string
          id: number
          nombre: string
          updated_at: string
          version: number
        }
        Insert: {
          activo?: boolean
          contenido: string
          created_at?: string
          id?: number
          nombre: string
          updated_at?: string
          version?: number
        }
        Update: {
          activo?: boolean
          contenido?: string
          created_at?: string
          id?: number
          nombre?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      cotizaciones: {
        Row: {
          cliente_email: string | null
          cliente_empresa: string | null
          cliente_nombre: string
          cliente_telefono: string | null
          created_at: string
          estado: string
          id: number
          items: string | null
          monto_total: number | null
          notas: string | null
          servicio: string
        }
        Insert: {
          cliente_email?: string | null
          cliente_empresa?: string | null
          cliente_nombre: string
          cliente_telefono?: string | null
          created_at?: string
          estado?: string
          id?: number
          items?: string | null
          monto_total?: number | null
          notas?: string | null
          servicio: string
        }
        Update: {
          cliente_email?: string | null
          cliente_empresa?: string | null
          cliente_nombre?: string
          cliente_telefono?: string | null
          created_at?: string
          estado?: string
          id?: number
          items?: string | null
          monto_total?: number | null
          notas?: string | null
          servicio?: string
        }
        Relationships: []
      }
      cotizaciones_arriendo: {
        Row: {
          cliente_email: string
          cliente_empresa: string | null
          cliente_id: number | null
          cliente_nombre: string
          cliente_rut: string | null
          cliente_telefono: string | null
          contrato_id: number | null
          created_at: string
          created_by: number | null
          distancia_km: number
          estado: string
          fecha_servicio: string
          fecha_solicitud: string
          horas_operario_estimadas: number
          id: number
          iva: number
          maquinaria_id: number
          notas_cliente: string | null
          numero: string
          operarios: number
          peajes: number
          precio_uso: number
          reserva_mantencion: number
          snapshot_costo_hora_operario: number
          snapshot_costo_km: number
          snapshot_mantencion_pct: number
          snapshot_tarifa_neta: number
          snapshot_utilidad_pct: number
          subtotal_neto: number
          total: number
          traslado_carga: number
          traslado_combustible: number
          traslado_operario: number
          ubicacion_servicio: string
          unidad: string
          unidades_solicitadas: number
          updated_at: string
          utilidad_real: number
        }
        Insert: {
          cliente_email: string
          cliente_empresa?: string | null
          cliente_id?: number | null
          cliente_nombre: string
          cliente_rut?: string | null
          cliente_telefono?: string | null
          contrato_id?: number | null
          created_at?: string
          created_by?: number | null
          distancia_km?: number
          estado?: string
          fecha_servicio: string
          fecha_solicitud?: string
          horas_operario_estimadas?: number
          id?: number
          iva: number
          maquinaria_id: number
          notas_cliente?: string | null
          numero: string
          operarios?: number
          peajes?: number
          precio_uso: number
          reserva_mantencion?: number
          snapshot_costo_hora_operario: number
          snapshot_costo_km: number
          snapshot_mantencion_pct: number
          snapshot_tarifa_neta: number
          snapshot_utilidad_pct: number
          subtotal_neto: number
          total: number
          traslado_carga?: number
          traslado_combustible?: number
          traslado_operario?: number
          ubicacion_servicio: string
          unidad: string
          unidades_solicitadas: number
          updated_at?: string
          utilidad_real?: number
        }
        Update: {
          cliente_email?: string
          cliente_empresa?: string | null
          cliente_id?: number | null
          cliente_nombre?: string
          cliente_rut?: string | null
          cliente_telefono?: string | null
          contrato_id?: number | null
          created_at?: string
          created_by?: number | null
          distancia_km?: number
          estado?: string
          fecha_servicio?: string
          fecha_solicitud?: string
          horas_operario_estimadas?: number
          id?: number
          iva?: number
          maquinaria_id?: number
          notas_cliente?: string | null
          numero?: string
          operarios?: number
          peajes?: number
          precio_uso?: number
          reserva_mantencion?: number
          snapshot_costo_hora_operario?: number
          snapshot_costo_km?: number
          snapshot_mantencion_pct?: number
          snapshot_tarifa_neta?: number
          snapshot_utilidad_pct?: number
          subtotal_neto?: number
          total?: number
          traslado_carga?: number
          traslado_combustible?: number
          traslado_operario?: number
          ubicacion_servicio?: string
          unidad?: string
          unidades_solicitadas?: number
          updated_at?: string
          utilidad_real?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotizaciones_arriendo_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_arriendo_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_arriendo_maquinaria_id_fkey"
            columns: ["maquinaria_id"]
            isOneToOne: false
            referencedRelation: "maquinarias"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          attempts: number
          context: Json | null
          created_at: string
          id: number
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          payload: Json
          sent_at: string | null
          status: string
          subject: string
          template_kind: string
          to_email: string
        }
        Insert: {
          attempts?: number
          context?: Json | null
          created_at?: string
          id?: number
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload: Json
          sent_at?: string | null
          status?: string
          subject: string
          template_kind: string
          to_email: string
        }
        Update: {
          attempts?: number
          context?: Json | null
          created_at?: string
          id?: number
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          sent_at?: string | null
          status?: string
          subject?: string
          template_kind?: string
          to_email?: string
        }
        Relationships: []
      }
      iva_libro_compras: {
        Row: {
          anulado: boolean
          anulado_at: string | null
          anulado_motivo: string | null
          archivo_url: string | null
          categoria: string | null
          created_at: string
          created_by: number | null
          doc_nro: string
          doc_tipo: string
          exento: boolean
          fecha_emision: string
          id: number
          iva: number
          monto_neto: number
          monto_total: number
          notas: string | null
          origen_id: number | null
          origen_tipo: string | null
          periodo: string
          proveedor_nombre: string
          proveedor_rut: string
        }
        Insert: {
          anulado?: boolean
          anulado_at?: string | null
          anulado_motivo?: string | null
          archivo_url?: string | null
          categoria?: string | null
          created_at?: string
          created_by?: number | null
          doc_nro: string
          doc_tipo: string
          exento?: boolean
          fecha_emision: string
          id?: number
          iva: number
          monto_neto: number
          monto_total: number
          notas?: string | null
          origen_id?: number | null
          origen_tipo?: string | null
          periodo: string
          proveedor_nombre: string
          proveedor_rut: string
        }
        Update: {
          anulado?: boolean
          anulado_at?: string | null
          anulado_motivo?: string | null
          archivo_url?: string | null
          categoria?: string | null
          created_at?: string
          created_by?: number | null
          doc_nro?: string
          doc_tipo?: string
          exento?: boolean
          fecha_emision?: string
          id?: number
          iva?: number
          monto_neto?: number
          monto_total?: number
          notas?: string | null
          origen_id?: number | null
          origen_tipo?: string | null
          periodo?: string
          proveedor_nombre?: string
          proveedor_rut?: string
        }
        Relationships: [
          {
            foreignKeyName: "iva_libro_compras_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      iva_libro_ventas: {
        Row: {
          anulado: boolean
          anulado_at: string | null
          anulado_motivo: string | null
          contraparte_email: string | null
          contraparte_nombre: string
          contraparte_rut: string | null
          created_at: string
          created_by: number | null
          doc_nro: string
          doc_tipo: string
          exento: boolean
          fecha_emision: string
          id: number
          iva: number
          monto_neto: number
          monto_total: number
          notas: string | null
          origen_id: number | null
          origen_tipo: string | null
          periodo: string
        }
        Insert: {
          anulado?: boolean
          anulado_at?: string | null
          anulado_motivo?: string | null
          contraparte_email?: string | null
          contraparte_nombre: string
          contraparte_rut?: string | null
          created_at?: string
          created_by?: number | null
          doc_nro: string
          doc_tipo: string
          exento?: boolean
          fecha_emision: string
          id?: number
          iva: number
          monto_neto: number
          monto_total: number
          notas?: string | null
          origen_id?: number | null
          origen_tipo?: string | null
          periodo: string
        }
        Update: {
          anulado?: boolean
          anulado_at?: string | null
          anulado_motivo?: string | null
          contraparte_email?: string | null
          contraparte_nombre?: string
          contraparte_rut?: string | null
          created_at?: string
          created_by?: number | null
          doc_nro?: string
          doc_tipo?: string
          exento?: boolean
          fecha_emision?: string
          id?: number
          iva?: number
          monto_neto?: number
          monto_total?: number
          notas?: string | null
          origen_id?: number | null
          origen_tipo?: string | null
          periodo?: string
        }
        Relationships: [
          {
            foreignKeyName: "iva_libro_ventas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      maestros: {
        Row: {
          activo: boolean
          banco: string | null
          codigo: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          nombre: string
          notas: string | null
          numero_cuenta: string | null
          porcentaje_comision: number
          rut: string
          telefono: string | null
          tipo_cuenta: string | null
        }
        Insert: {
          activo?: boolean
          banco?: string | null
          codigo: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          nombre: string
          notas?: string | null
          numero_cuenta?: string | null
          porcentaje_comision?: number
          rut: string
          telefono?: string | null
          tipo_cuenta?: string | null
        }
        Update: {
          activo?: boolean
          banco?: string | null
          codigo?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          numero_cuenta?: string | null
          porcentaje_comision?: number
          rut?: string
          telefono?: string | null
          tipo_cuenta?: string | null
        }
        Relationships: []
      }
      maquinaria_documentos: {
        Row: {
          archivo_mime: string
          archivo_path: string
          archivo_size_bytes: number
          created_at: string
          created_by: number | null
          descripcion: string | null
          fecha_emision: string | null
          fecha_vencimiento: string | null
          id: number
          maquinaria_id: number
          nombre: string
          tipo: string
          updated_at: string
        }
        Insert: {
          archivo_mime: string
          archivo_path: string
          archivo_size_bytes: number
          created_at?: string
          created_by?: number | null
          descripcion?: string | null
          fecha_emision?: string | null
          fecha_vencimiento?: string | null
          id?: number
          maquinaria_id: number
          nombre: string
          tipo: string
          updated_at?: string
        }
        Update: {
          archivo_mime?: string
          archivo_path?: string
          archivo_size_bytes?: number
          created_at?: string
          created_by?: number | null
          descripcion?: string | null
          fecha_emision?: string | null
          fecha_vencimiento?: string | null
          id?: number
          maquinaria_id?: number
          nombre?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maquinaria_documentos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maquinaria_documentos_maquinaria_id_fkey"
            columns: ["maquinaria_id"]
            isOneToOne: false
            referencedRelation: "maquinarias"
            referencedColumns: ["id"]
          },
        ]
      }
      maquinaria_mantenciones: {
        Row: {
          costo: number
          created_at: string
          created_by: string | null
          descripcion: string
          factura_url: string | null
          fecha: string
          horometro_km: number | null
          id: string
          maquinaria_id: number
          notas: string | null
          proveedor: string | null
          proxima_mantencion_at: string | null
          tipo: string
        }
        Insert: {
          costo?: number
          created_at?: string
          created_by?: string | null
          descripcion: string
          factura_url?: string | null
          fecha?: string
          horometro_km?: number | null
          id?: string
          maquinaria_id: number
          notas?: string | null
          proveedor?: string | null
          proxima_mantencion_at?: string | null
          tipo: string
        }
        Update: {
          costo?: number
          created_at?: string
          created_by?: string | null
          descripcion?: string
          factura_url?: string | null
          fecha?: string
          horometro_km?: number | null
          id?: string
          maquinaria_id?: number
          notas?: string | null
          proveedor?: string | null
          proxima_mantencion_at?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "maquinaria_mantenciones_maquinaria_id_fkey"
            columns: ["maquinaria_id"]
            isOneToOne: false
            referencedRelation: "maquinarias"
            referencedColumns: ["id"]
          },
        ]
      }
      maquinarias: {
        Row: {
          created_at: string
          descripcion: string | null
          especificaciones: string | null
          estado: string
          garantia_monto: number | null
          id: number
          imagen: string | null
          minimo_unidades: number | null
          nombre: string
          precio_dia: number | null
          precio_mes: number | null
          precio_semana: number | null
          requiere_traslado: boolean | null
          tarifa_neta: number | null
          tipo: string
          tipo_combustible: string | null
          unidad_tarifa: string | null
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          especificaciones?: string | null
          estado?: string
          garantia_monto?: number | null
          id?: number
          imagen?: string | null
          minimo_unidades?: number | null
          nombre: string
          precio_dia?: number | null
          precio_mes?: number | null
          precio_semana?: number | null
          requiere_traslado?: boolean | null
          tarifa_neta?: number | null
          tipo: string
          tipo_combustible?: string | null
          unidad_tarifa?: string | null
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          especificaciones?: string | null
          estado?: string
          garantia_monto?: number | null
          id?: number
          imagen?: string | null
          minimo_unidades?: number | null
          nombre?: string
          precio_dia?: number | null
          precio_mes?: number | null
          precio_semana?: number | null
          requiere_traslado?: boolean | null
          tarifa_neta?: number | null
          tipo?: string
          tipo_combustible?: string | null
          unidad_tarifa?: string | null
        }
        Relationships: []
      }
      otp_codigos: {
        Row: {
          canal_usado: string
          codigo_hash: string
          contexto: string
          contexto_id: string | null
          created_at: string
          destino: string
          expira_at: string
          id: string
          intentos: number
          max_intentos: number
          provider: string
          verificado_at: string | null
        }
        Insert: {
          canal_usado: string
          codigo_hash: string
          contexto: string
          contexto_id?: string | null
          created_at?: string
          destino: string
          expira_at: string
          id?: string
          intentos?: number
          max_intentos?: number
          provider: string
          verificado_at?: string | null
        }
        Update: {
          canal_usado?: string
          codigo_hash?: string
          contexto?: string
          contexto_id?: string | null
          created_at?: string
          destino?: string
          expira_at?: string
          id?: string
          intentos?: number
          max_intentos?: number
          provider?: string
          verificado_at?: string | null
        }
        Relationships: []
      }
      otp_eventos: {
        Row: {
          canal: string
          contexto: string | null
          created_at: string
          destino: string
          error_msg: string | null
          evento: string
          id: string
          ip: string | null
          otp_id: string | null
          provider: string
          raw_response: Json | null
          user_agent: string | null
        }
        Insert: {
          canal: string
          contexto?: string | null
          created_at?: string
          destino: string
          error_msg?: string | null
          evento: string
          id?: string
          ip?: string | null
          otp_id?: string | null
          provider: string
          raw_response?: Json | null
          user_agent?: string | null
        }
        Update: {
          canal?: string
          contexto?: string | null
          created_at?: string
          destino?: string
          error_msg?: string | null
          evento?: string
          id?: string
          ip?: string | null
          otp_id?: string | null
          provider?: string
          raw_response?: Json | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "otp_eventos_otp_id_fkey"
            columns: ["otp_id"]
            isOneToOne: false
            referencedRelation: "otp_codigos"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos_eventos: {
        Row: {
          cotizacion_id: number | null
          cotizacion_numero: string | null
          external_reference: string | null
          payment_id: string
          processed_at: string
          raw: Json | null
          status: string
          transaction_amount: number | null
        }
        Insert: {
          cotizacion_id?: number | null
          cotizacion_numero?: string | null
          external_reference?: string | null
          payment_id: string
          processed_at?: string
          raw?: Json | null
          status: string
          transaction_amount?: number | null
        }
        Update: {
          cotizacion_id?: number | null
          cotizacion_numero?: string | null
          external_reference?: string | null
          payment_id?: string
          processed_at?: string
          raw?: Json | null
          status?: string
          transaction_amount?: number | null
        }
        Relationships: []
      }
      proyectos: {
        Row: {
          cliente: string | null
          cliente_id: number | null
          created_at: string
          descripcion: string | null
          estado: string
          fecha_fin: string | null
          fecha_inicio: string | null
          id: number
          monto: number | null
          nombre: string
          notas: string | null
          tipo: string
        }
        Insert: {
          cliente?: string | null
          cliente_id?: number | null
          created_at?: string
          descripcion?: string | null
          estado?: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: number
          monto?: number | null
          nombre: string
          notas?: string | null
          tipo: string
        }
        Update: {
          cliente?: string | null
          cliente_id?: number | null
          created_at?: string
          descripcion?: string | null
          estado?: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: number
          monto?: number | null
          nombre?: string
          notas?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "proyectos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_attempts: {
        Row: {
          count: number
          key: string
          reset_at: string
          updated_at: string
        }
        Insert: {
          count?: number
          key: string
          reset_at: string
          updated_at?: string
        }
        Update: {
          count?: number
          key?: string
          reset_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_change_log: {
        Row: {
          changed_by_email: string
          changed_by_user_id: number | null
          created_at: string
          id: number
          ip_address: string | null
          new_role: string
          previous_role: string
          reason: string | null
          target_user_email: string
          target_user_id: number
          user_agent: string | null
        }
        Insert: {
          changed_by_email: string
          changed_by_user_id?: number | null
          created_at?: string
          id?: number
          ip_address?: string | null
          new_role: string
          previous_role: string
          reason?: string | null
          target_user_email: string
          target_user_id: number
          user_agent?: string | null
        }
        Update: {
          changed_by_email?: string
          changed_by_user_id?: number | null
          created_at?: string
          id?: number
          ip_address?: string | null
          new_role?: string
          previous_role?: string
          reason?: string | null
          target_user_email?: string
          target_user_id?: number
          user_agent?: string | null
        }
        Relationships: []
      }
      solicitudes: {
        Row: {
          cliente_email: string | null
          cliente_empresa: string | null
          cliente_nombre: string
          cliente_telefono: string
          created_at: string
          estado: string
          fecha_fin: string | null
          fecha_inicio: string | null
          id: number
          maquinaria_id: number | null
          maquinaria_nombre: string | null
          mensaje: string | null
          notas: string | null
          servicio: string | null
        }
        Insert: {
          cliente_email?: string | null
          cliente_empresa?: string | null
          cliente_nombre: string
          cliente_telefono: string
          created_at?: string
          estado?: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: number
          maquinaria_id?: number | null
          maquinaria_nombre?: string | null
          mensaje?: string | null
          notas?: string | null
          servicio?: string | null
        }
        Update: {
          cliente_email?: string | null
          cliente_empresa?: string | null
          cliente_nombre?: string
          cliente_telefono?: string
          created_at?: string
          estado?: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: number
          maquinaria_id?: number | null
          maquinaria_nombre?: string | null
          mensaje?: string | null
          notas?: string | null
          servicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_maquinaria_id_fkey"
            columns: ["maquinaria_id"]
            isOneToOne: false
            referencedRelation: "maquinarias"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifas_traslado: {
        Row: {
          carga_descarga_horas: number
          costo_hora_operario: number
          costo_km: number
          created_at: string
          created_by: number | null
          id: number
          notas: string | null
          reserva_mantencion_pct: number
          reserva_utilidad_pct: number
          vigente_desde: string
        }
        Insert: {
          carga_descarga_horas?: number
          costo_hora_operario: number
          costo_km: number
          created_at?: string
          created_by?: number | null
          id?: number
          notas?: string | null
          reserva_mantencion_pct?: number
          reserva_utilidad_pct?: number
          vigente_desde?: string
        }
        Update: {
          carga_descarga_horas?: number
          costo_hora_operario?: number
          costo_km?: number
          created_at?: string
          created_by?: number | null
          id?: number
          notas?: string | null
          reserva_mantencion_pct?: number
          reserva_utilidad_pct?: number
          vigente_desde?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarifas_traslado_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ip: string | null
          last_used_at: string
          revoked_at: string | null
          role: string | null
          scope: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          ip?: string | null
          last_used_at?: string
          revoked_at?: string | null
          role?: string | null
          scope: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ip?: string | null
          last_used_at?: string
          revoked_at?: string | null
          role?: string | null
          scope?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: number
          name: string
          password: string
          role: string
          scope: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: number
          name: string
          password: string
          role?: string
          scope?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: number
          name?: string
          password?: string
          role?: string
          scope?: string
        }
        Relationships: []
      }
    }
    Views: {
      barraca_productos_public: {
        Row: {
          activo: boolean | null
          categoria_id: number | null
          codigo: string | null
          created_at: string | null
          descripcion: string | null
          destacado: boolean | null
          en_oferta: boolean | null
          id: number | null
          imagen: string | null
          medida: string | null
          nombre: string | null
          peso: number | null
          precio: number | null
          precio_original: number | null
          producto_padre_id: number | null
          slug: string | null
          solo_cotizar: boolean | null
          stock: number | null
          unidad: string | null
        }
        Insert: {
          activo?: boolean | null
          categoria_id?: number | null
          codigo?: string | null
          created_at?: string | null
          descripcion?: string | null
          destacado?: boolean | null
          en_oferta?: boolean | null
          id?: number | null
          imagen?: string | null
          medida?: string | null
          nombre?: string | null
          peso?: number | null
          precio?: number | null
          precio_original?: number | null
          producto_padre_id?: number | null
          slug?: string | null
          solo_cotizar?: boolean | null
          stock?: number | null
          unidad?: string | null
        }
        Update: {
          activo?: boolean | null
          categoria_id?: number | null
          codigo?: string | null
          created_at?: string | null
          descripcion?: string | null
          destacado?: boolean | null
          en_oferta?: boolean | null
          id?: number | null
          imagen?: string | null
          medida?: string | null
          nombre?: string | null
          peso?: number | null
          precio?: number | null
          precio_original?: number | null
          producto_padre_id?: number | null
          slug?: string | null
          solo_cotizar?: boolean | null
          stock?: number | null
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barraca_productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "barraca_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      barraca_productos_rating: {
        Row: {
          producto_id: number | null
          r1: number | null
          r2: number | null
          r3: number | null
          r4: number | null
          r5: number | null
          rating_promedio: number | null
          total_reviews: number | null
        }
        Relationships: [
          {
            foreignKeyName: "barraca_reviews_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "barraca_productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barraca_reviews_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "barraca_productos_public"
            referencedColumns: ["id"]
          },
        ]
      }
      combustible_resumen_mensual: {
        Row: {
          cantidad_facturas: number | null
          iec_recuperable: number | null
          maquinaria_id: number | null
          maquinaria_nombre: string | null
          mes_tributario: string | null
          tipo_combustible: string | null
          total_litros: number | null
          total_monto: number | null
        }
        Relationships: [
          {
            foreignKeyName: "combustible_items_maquinaria_id_fkey"
            columns: ["maquinaria_id"]
            isOneToOne: false
            referencedRelation: "maquinarias"
            referencedColumns: ["id"]
          },
        ]
      }
      iva_resumen_mensual: {
        Row: {
          compras_count: number | null
          compras_neto: number | null
          f29_a_pagar: number | null
          iva_credito: number | null
          iva_debito: number | null
          periodo: string | null
          ventas_count: number | null
          ventas_neto: number | null
        }
        Relationships: []
      }
      maestros_public: {
        Row: {
          activo: boolean | null
          codigo: string | null
          created_at: string | null
          id: string | null
          nombre: string | null
          porcentaje_comision: number | null
          rut_masked: string | null
        }
        Insert: {
          activo?: boolean | null
          codigo?: string | null
          created_at?: string | null
          id?: string | null
          nombre?: string | null
          porcentaje_comision?: number | null
          rut_masked?: never
        }
        Update: {
          activo?: boolean | null
          codigo?: string | null
          created_at?: string | null
          id?: string | null
          nombre?: string | null
          porcentaje_comision?: number | null
          rut_masked?: never
        }
        Relationships: []
      }
      maquinarias_proxima_mantencion: {
        Row: {
          dias_restantes: number | null
          maquinaria_id: number | null
          proxima_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maquinaria_mantenciones_maquinaria_id_fkey"
            columns: ["maquinaria_id"]
            isOneToOne: false
            referencedRelation: "maquinarias"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifa_traslado_actual: {
        Row: {
          carga_descarga_horas: number | null
          costo_hora_operario: number | null
          costo_km: number | null
          created_at: string | null
          created_by: number | null
          id: number | null
          notas: string | null
          reserva_mantencion_pct: number | null
          reserva_utilidad_pct: number | null
          vigente_desde: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarifas_traslado_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      combustible_calcular_iec: {
        Args: {
          p_fecha: string
          p_litros: number
          p_tipo: string
          p_utm_actual?: number
        }
        Returns: number
      }
      combustible_tarifa_iec_aplicable: {
        Args: { p_fecha: string; p_tipo: string }
        Returns: {
          componente_fijo_clp_litro: number
          componente_variable_utm_m3: number
          decreto_supremo: string
          utm_referencia_clp: number
        }[]
      }
      maquinaria_disponible_en_fecha: {
        Args: { p_fecha: string; p_maquinaria_id: number }
        Returns: boolean
      }
      next_barraca_cotizacion_numero: { Args: never; Returns: string }
      next_cot_arriendo_numero: { Args: never; Returns: string }
      next_maestro_codigo: { Args: never; Returns: string }
      precio_vigente_acumulado_dias: {
        Args: {
          p_precio: number
          p_producto_id: number
          p_ventana_dias?: number
        }
        Returns: number
      }
      rate_limit_check_and_increment: {
        Args: {
          p_key: string
          p_max_attempts: number
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          count: number
          reset_at: string
        }[]
      }
      rate_limit_cleanup: { Args: never; Returns: number }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
