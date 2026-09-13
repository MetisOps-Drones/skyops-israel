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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      aip_reference_zones: {
        Row: {
          altitude_text: string
          code: string | null
          created_at: string
          geom_geojson: Json
          id: string
          kind: Database["public"]["Enums"]["aip_zone_kind"]
          max_altitude_ft: number | null
          min_altitude_ft: number | null
          name: string
          source_edition: string
          source_sheet: string
        }
        Insert: {
          altitude_text: string
          code?: string | null
          created_at?: string
          geom_geojson: Json
          id?: string
          kind: Database["public"]["Enums"]["aip_zone_kind"]
          max_altitude_ft?: number | null
          min_altitude_ft?: number | null
          name: string
          source_edition: string
          source_sheet: string
        }
        Update: {
          altitude_text?: string
          code?: string | null
          created_at?: string
          geom_geojson?: Json
          id?: string
          kind?: Database["public"]["Enums"]["aip_zone_kind"]
          max_altitude_ft?: number | null
          min_altitude_ft?: number | null
          name?: string
          source_edition?: string
          source_sheet?: string
        }
        Relationships: []
      }
      airspace_zones: {
        Row: {
          active_schedule: Json
          created_at: string
          geom: unknown
          geom_geojson: Json
          id: string
          max_altitude_m: number
          min_altitude_m: number
          name: string
          source_notes: string | null
          type: Database["public"]["Enums"]["airspace_zone_type"]
          updated_at: string
        }
        Insert: {
          active_schedule?: Json
          created_at?: string
          geom: unknown
          geom_geojson?: Json
          id?: string
          max_altitude_m: number
          min_altitude_m?: number
          name: string
          source_notes?: string | null
          type: Database["public"]["Enums"]["airspace_zone_type"]
          updated_at?: string
        }
        Update: {
          active_schedule?: Json
          created_at?: string
          geom?: unknown
          geom_geojson?: Json
          id?: string
          max_altitude_m?: number
          min_altitude_m?: number
          name?: string
          source_notes?: string | null
          type?: Database["public"]["Enums"]["airspace_zone_type"]
          updated_at?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at: string | null
          layer: Database["public"]["Enums"]["api_layer"]
          revoked_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at?: string | null
          layer: Database["public"]["Enums"]["api_layer"]
          revoked_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          label?: string
          last_used_at?: string | null
          layer?: Database["public"]["Enums"]["api_layer"]
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_events: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_name: string
          id: string
          metadata: Json
          org_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_name: string
          id?: string
          metadata?: Json
          org_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_name?: string
          id?: string
          metadata?: Json
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      batteries: {
        Row: {
          created_at: string
          cycle_count: number
          drone_id: string
          health_status: Database["public"]["Enums"]["battery_health_status"]
          id: string
          last_voltage_reading: number | null
          purchased_at: string | null
          serial_number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle_count?: number
          drone_id: string
          health_status?: Database["public"]["Enums"]["battery_health_status"]
          id?: string
          last_voltage_reading?: number | null
          purchased_at?: string | null
          serial_number: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle_count?: number
          drone_id?: string
          health_status?: Database["public"]["Enums"]["battery_health_status"]
          id?: string
          last_voltage_reading?: number | null
          purchased_at?: string | null
          serial_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batteries_drone_id_fkey"
            columns: ["drone_id"]
            isOneToOne: false
            referencedRelation: "drones"
            referencedColumns: ["id"]
          },
        ]
      }
      battery_readings: {
        Row: {
          battery_id: string
          capacity_percent: number | null
          created_at: string
          id: string
          recorded_at: string
          source: string
          voltage: number | null
        }
        Insert: {
          battery_id: string
          capacity_percent?: number | null
          created_at?: string
          id?: string
          recorded_at?: string
          source?: string
          voltage?: number | null
        }
        Update: {
          battery_id?: string
          capacity_percent?: number | null
          created_at?: string
          id?: string
          recorded_at?: string
          source?: string
          voltage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "battery_readings_battery_id_fkey"
            columns: ["battery_id"]
            isOneToOne: false
            referencedRelation: "batteries"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          org_id: string | null
          owner_id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          org_id?: string | null
          owner_id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          org_id?: string | null
          owner_id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          id: string
          message: string | null
          org_id: string
          pilot_id: string
          requested_by: string
          status: Database["public"]["Enums"]["contact_request_status"]
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          id?: string
          message?: string | null
          org_id: string
          pilot_id: string
          requested_by: string
          status?: Database["public"]["Enums"]["contact_request_status"]
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          id?: string
          message?: string | null
          org_id?: string
          pilot_id?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["contact_request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "contact_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_requests_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          id: string
          kind: Database["public"]["Enums"]["document_kind"]
          linked_license_id: string | null
          ocr_confidence: number | null
          ocr_extracted_expires_at: string | null
          ocr_status: Database["public"]["Enums"]["document_ocr_status"]
          storage_path: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          id?: string
          kind: Database["public"]["Enums"]["document_kind"]
          linked_license_id?: string | null
          ocr_confidence?: number | null
          ocr_extracted_expires_at?: string | null
          ocr_status?: Database["public"]["Enums"]["document_ocr_status"]
          storage_path: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          linked_license_id?: string | null
          ocr_confidence?: number | null
          ocr_extracted_expires_at?: string | null
          ocr_status?: Database["public"]["Enums"]["document_ocr_status"]
          storage_path?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_linked_license_id_fkey"
            columns: ["linked_license_id"]
            isOneToOne: false
            referencedRelation: "pilot_licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drone_maintenance_log: {
        Row: {
          cost: number | null
          created_at: string
          description: string
          drone_id: string
          id: string
          kind: Database["public"]["Enums"]["maintenance_entry_kind"]
          logged_by: string | null
          performed_at: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          description: string
          drone_id: string
          id?: string
          kind: Database["public"]["Enums"]["maintenance_entry_kind"]
          logged_by?: string | null
          performed_at?: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          description?: string
          drone_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["maintenance_entry_kind"]
          logged_by?: string | null
          performed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drone_maintenance_log_drone_id_fkey"
            columns: ["drone_id"]
            isOneToOne: false
            referencedRelation: "drones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drone_maintenance_log_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drones: {
        Row: {
          created_at: string
          id: string
          last_inspection_at: string | null
          last_maintenance_at: string | null
          last_maintenance_flight_minutes: number
          maintenance_interval_minutes: number
          manufacturer: string
          model: string
          mtow_grams: number
          nickname: string
          org_id: string | null
          registration_expires_at: string | null
          registration_number: string | null
          registration_status: Database["public"]["Enums"]["license_status"]
          serial_number: string
          status: Database["public"]["Enums"]["drone_status"]
          total_flight_minutes: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_inspection_at?: string | null
          last_maintenance_at?: string | null
          last_maintenance_flight_minutes?: number
          maintenance_interval_minutes?: number
          manufacturer: string
          model: string
          mtow_grams: number
          nickname: string
          org_id?: string | null
          registration_expires_at?: string | null
          registration_number?: string | null
          registration_status?: Database["public"]["Enums"]["license_status"]
          serial_number: string
          status?: Database["public"]["Enums"]["drone_status"]
          total_flight_minutes?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_inspection_at?: string | null
          last_maintenance_at?: string | null
          last_maintenance_flight_minutes?: number
          maintenance_interval_minutes?: number
          manufacturer?: string
          model?: string
          mtow_grams?: number
          nickname?: string
          org_id?: string | null
          registration_expires_at?: string | null
          registration_number?: string | null
          registration_status?: Database["public"]["Enums"]["license_status"]
          serial_number?: string
          status?: Database["public"]["Enums"]["drone_status"]
          total_flight_minutes?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drones_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drones_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_handoffs: {
        Row: {
          checked_in_at: string | null
          checked_in_condition:
            | Database["public"]["Enums"]["equipment_condition"]
            | null
          checked_in_notes: string | null
          checked_out_at: string
          checked_out_condition: Database["public"]["Enums"]["equipment_condition"]
          checked_out_notes: string | null
          created_at: string
          drone_id: string
          id: string
          status: Database["public"]["Enums"]["equipment_handoff_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_condition?:
            | Database["public"]["Enums"]["equipment_condition"]
            | null
          checked_in_notes?: string | null
          checked_out_at?: string
          checked_out_condition?: Database["public"]["Enums"]["equipment_condition"]
          checked_out_notes?: string | null
          created_at?: string
          drone_id: string
          id?: string
          status?: Database["public"]["Enums"]["equipment_handoff_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          checked_in_at?: string | null
          checked_in_condition?:
            | Database["public"]["Enums"]["equipment_condition"]
            | null
          checked_in_notes?: string | null
          checked_out_at?: string
          checked_out_condition?: Database["public"]["Enums"]["equipment_condition"]
          checked_out_notes?: string | null
          created_at?: string
          drone_id?: string
          id?: string
          status?: Database["public"]["Enums"]["equipment_handoff_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_handoffs_drone_id_fkey"
            columns: ["drone_id"]
            isOneToOne: false
            referencedRelation: "drones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_handoffs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_logs: {
        Row: {
          battery_id: string | null
          client_id: string | null
          client_name: string | null
          cost: number | null
          created_at: string
          drone_id: string
          duration_minutes: number | null
          end_time: string
          flight_request_id: string | null
          id: string
          max_altitude_m: number | null
          max_distance_m: number | null
          notes: string | null
          price: number | null
          share_token: string | null
          start_time: string
          telemetry_data: Json
          telemetry_source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          battery_id?: string | null
          client_id?: string | null
          client_name?: string | null
          cost?: number | null
          created_at?: string
          drone_id: string
          duration_minutes?: number | null
          end_time: string
          flight_request_id?: string | null
          id?: string
          max_altitude_m?: number | null
          max_distance_m?: number | null
          notes?: string | null
          price?: number | null
          share_token?: string | null
          start_time: string
          telemetry_data?: Json
          telemetry_source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          battery_id?: string | null
          client_id?: string | null
          client_name?: string | null
          cost?: number | null
          created_at?: string
          drone_id?: string
          duration_minutes?: number | null
          end_time?: string
          flight_request_id?: string | null
          id?: string
          max_altitude_m?: number | null
          max_distance_m?: number | null
          notes?: string | null
          price?: number | null
          share_token?: string | null
          start_time?: string
          telemetry_data?: Json
          telemetry_source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_logs_battery_id_fkey"
            columns: ["battery_id"]
            isOneToOne: false
            referencedRelation: "batteries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_logs_drone_id_fkey"
            columns: ["drone_id"]
            isOneToOne: false
            referencedRelation: "drones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_logs_flight_request_id_fkey"
            columns: ["flight_request_id"]
            isOneToOne: false
            referencedRelation: "flight_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_requests: {
        Row: {
          center_point: unknown
          center_point_geojson: Json
          created_at: string
          dispatcher_notes: string | null
          drone_id: string | null
          emergency_contact_phone: string | null
          end_time: string
          flight_purpose: Database["public"]["Enums"]["flight_purpose"]
          id: string
          intersecting_zone_ids: string[]
          max_altitude_meters: number
          notam_code: string | null
          polygon: unknown
          polygon_geojson: Json | null
          radius_meters: number | null
          request_type: Database["public"]["Enums"]["flight_request_type"]
          reviewed_at: string | null
          reviewed_by: string | null
          start_time: string
          status: Database["public"]["Enums"]["flight_request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          center_point: unknown
          center_point_geojson?: Json
          created_at?: string
          dispatcher_notes?: string | null
          drone_id?: string | null
          emergency_contact_phone?: string | null
          end_time: string
          flight_purpose?: Database["public"]["Enums"]["flight_purpose"]
          id?: string
          intersecting_zone_ids?: string[]
          max_altitude_meters: number
          notam_code?: string | null
          polygon?: unknown
          polygon_geojson?: Json | null
          radius_meters?: number | null
          request_type: Database["public"]["Enums"]["flight_request_type"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["flight_request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          center_point?: unknown
          center_point_geojson?: Json
          created_at?: string
          dispatcher_notes?: string | null
          drone_id?: string | null
          emergency_contact_phone?: string | null
          end_time?: string
          flight_purpose?: Database["public"]["Enums"]["flight_purpose"]
          id?: string
          intersecting_zone_ids?: string[]
          max_altitude_meters?: number
          notam_code?: string | null
          polygon?: unknown
          polygon_geojson?: Json | null
          radius_meters?: number | null
          request_type?: Database["public"]["Enums"]["flight_request_type"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["flight_request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_requests_drone_id_fkey"
            columns: ["drone_id"]
            isOneToOne: false
            referencedRelation: "drones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      government_validation_requests: {
        Row: {
          checked_at: string | null
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["government_validation_entity"]
          id: string
          provider: string | null
          requested_by: string | null
          response: Json | null
          status: Database["public"]["Enums"]["government_validation_status"]
          submitted_value: string
        }
        Insert: {
          checked_at?: string | null
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["government_validation_entity"]
          id?: string
          provider?: string | null
          requested_by?: string | null
          response?: Json | null
          status?: Database["public"]["Enums"]["government_validation_status"]
          submitted_value: string
        }
        Update: {
          checked_at?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["government_validation_entity"]
          id?: string
          provider?: string | null
          requested_by?: string | null
          response?: Json | null
          status?: Database["public"]["Enums"]["government_validation_status"]
          submitted_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "government_validation_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: Database["public"]["Enums"]["inventory_item_category"]
          created_at: string
          id: string
          low_stock_threshold: number
          name: string
          org_id: string | null
          quantity_on_hand: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["inventory_item_category"]
          created_at?: string
          id?: string
          low_stock_threshold?: number
          name: string
          org_id?: string | null
          quantity_on_hand?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["inventory_item_category"]
          created_at?: string
          id?: string
          low_stock_threshold?: number
          name?: string
          org_id?: string | null
          quantity_on_hand?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      layer_source_overrides: {
        Row: {
          layer: Database["public"]["Enums"]["api_layer"]
          override_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          layer: Database["public"]["Enums"]["api_layer"]
          override_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          layer?: Database["public"]["Enums"]["api_layer"]
          override_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "layer_source_overrides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_progress: {
        Row: {
          completed_lessons: string[]
          course_id: Database["public"]["Enums"]["lms_course_id"]
          created_at: string
          last_activity_at: string
          passed_mock_exam: boolean
          quiz_scores: Json
          subscription_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_lessons?: string[]
          course_id: Database["public"]["Enums"]["lms_course_id"]
          created_at?: string
          last_activity_at?: string
          passed_mock_exam?: boolean
          quiz_scores?: Json
          subscription_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_lessons?: string[]
          course_id?: Database["public"]["Enums"]["lms_course_id"]
          created_at?: string
          last_activity_at?: string
          passed_mock_exam?: boolean
          quiz_scores?: Json
          subscription_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          metadata: Json
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          metadata?: Json
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          metadata?: Json
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          added_at: string
          decided_at: string | null
          decided_by: string | null
          org_id: string
          role: Database["public"]["Enums"]["user_role"] | null
          status: Database["public"]["Enums"]["org_membership_status"]
          user_id: string
        }
        Insert: {
          added_at?: string
          decided_at?: string | null
          decided_by?: string | null
          org_id: string
          role?: Database["public"]["Enums"]["user_role"] | null
          status?: Database["public"]["Enums"]["org_membership_status"]
          user_id: string
        }
        Update: {
          added_at?: string
          decided_at?: string | null
          decided_by?: string | null
          org_id?: string
          role?: Database["public"]["Enums"]["user_role"] | null
          status?: Database["public"]["Enums"]["org_membership_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pilot_licenses: {
        Row: {
          created_at: string
          document_url: string | null
          expires_at: string
          id: string
          issued_at: string | null
          license_number: string
          license_type: Database["public"]["Enums"]["license_type"]
          ocr_extracted_at: string | null
          ocr_raw_text: string | null
          status: Database["public"]["Enums"]["license_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_url?: string | null
          expires_at: string
          id?: string
          issued_at?: string | null
          license_number: string
          license_type: Database["public"]["Enums"]["license_type"]
          ocr_extracted_at?: string | null
          ocr_raw_text?: string | null
          status?: Database["public"]["Enums"]["license_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_url?: string | null
          expires_at?: string
          id?: string
          issued_at?: string | null
          license_number?: string
          license_type?: Database["public"]["Enums"]["license_type"]
          ocr_extracted_at?: string | null
          ocr_raw_text?: string | null
          status?: Database["public"]["Enums"]["license_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilot_licenses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_profiles: {
        Row: {
          drone_models: string[]
          flight_modes: string[]
          headline: string | null
          id: string
          service_areas: string[]
          skills: string[]
          software: string[]
          specializations: string[]
          uav_categories: string[]
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          drone_models?: string[]
          flight_modes?: string[]
          headline?: string | null
          id: string
          service_areas?: string[]
          skills?: string[]
          software?: string[]
          specializations?: string[]
          uav_categories?: string[]
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          drone_models?: string[]
          flight_modes?: string[]
          headline?: string | null
          id?: string
          service_areas?: string[]
          skills?: string[]
          software?: string[]
          specializations?: string[]
          uav_categories?: string[]
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pilot_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          org_id: string
          pilot_id: string
          rating: number
          reviewer_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          org_id: string
          pilot_id: string
          rating: number
          reviewer_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          org_id?: string
          pilot_id?: string
          rating?: number
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilot_reviews_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_reviews_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          business_hours: Json | null
          business_id: string | null
          created_at: string
          freelance_available: boolean
          full_name: string
          id: string
          is_verified_pilot: boolean
          notify_email: boolean
          notify_sms: boolean
          org_id: string | null
          phone: string | null
          plan_code: string | null
          professional_category: string | null
          role: Database["public"]["Enums"]["user_role"]
          title: string | null
          trial_ends_at: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          business_hours?: Json | null
          business_id?: string | null
          created_at?: string
          freelance_available?: boolean
          full_name: string
          id: string
          is_verified_pilot?: boolean
          notify_email?: boolean
          notify_sms?: boolean
          org_id?: string | null
          phone?: string | null
          plan_code?: string | null
          professional_category?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          title?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          business_hours?: Json | null
          business_id?: string | null
          created_at?: string
          freelance_available?: boolean
          full_name?: string
          id?: string
          is_verified_pilot?: boolean
          notify_email?: boolean
          notify_sms?: boolean
          org_id?: string | null
          phone?: string | null
          plan_code?: string | null
          professional_category?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          title?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      proximity_check_cache: {
        Row: {
          center_lat: number
          center_lng: number
          checked_at: string
          findings: Json
          grid_key: string
        }
        Insert: {
          center_lat: number
          center_lng: number
          checked_at?: string
          findings: Json
          grid_key: string
        }
        Update: {
          center_lat?: number
          center_lng?: number
          checked_at?: string
          findings?: Json
          grid_key?: string
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      special_authorization_types: {
        Row: {
          active: boolean
          created_at: string
          description: string
          file_url: string | null
          id: string
          name: string
          price_ils: number | null
          regulation_number: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description: string
          file_url?: string | null
          id?: string
          name: string
          price_ils?: number | null
          regulation_number?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          file_url?: string | null
          id?: string
          name?: string
          price_ils?: number | null
          regulation_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_special_authorizations: {
        Row: {
          authorization_type_id: string
          created_at: string
          file_delivered_at: string | null
          id: string
          purchased_at: string | null
          status: Database["public"]["Enums"]["special_authorization_status"]
          user_id: string
        }
        Insert: {
          authorization_type_id: string
          created_at?: string
          file_delivered_at?: string | null
          id?: string
          purchased_at?: string | null
          status?: Database["public"]["Enums"]["special_authorization_status"]
          user_id: string
        }
        Update: {
          authorization_type_id?: string
          created_at?: string
          file_delivered_at?: string | null
          id?: string
          purchased_at?: string | null
          status?: Database["public"]["Enums"]["special_authorization_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_special_authorizations_authorization_type_id_fkey"
            columns: ["authorization_type_id"]
            isOneToOne: false
            referencedRelation: "special_authorization_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_special_authorizations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      admin_organizations_overview: {
        Args: never
        Returns: {
          created_at: string
          drone_count: number
          flight_request_count_30d: number
          id: string
          member_count: number
          name: string
        }[]
      }
      analytics_active_user_count: {
        Args: { range_end: string; range_start: string; target_org_id: string }
        Returns: number
      }
      analytics_daily_activity: {
        Args: { range_end: string; range_start: string; target_org_id: string }
        Returns: {
          count: number
          day: string
        }[]
      }
      analytics_event_breakdown: {
        Args: { range_end: string; range_start: string; target_org_id: string }
        Returns: {
          count: number
          event_name: string
        }[]
      }
      analytics_total_event_count: {
        Args: { range_end: string; range_start: string; target_org_id: string }
        Returns: number
      }
      assert_analytics_access: {
        Args: { target_org_id: string }
        Returns: undefined
      }
      create_organization_as_owner: {
        Args: { org_name: string }
        Returns: string
      }
      current_org_id: { Args: never; Returns: string }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      find_intersecting_zones: {
        Args: {
          candidate_geom_geojson: Json
          candidate_max_alt: number
          candidate_min_alt: number
        }
        Returns: {
          active_schedule: Json
          created_at: string
          geom: unknown
          geom_geojson: Json
          id: string
          max_altitude_m: number
          min_altitude_m: number
          name: string
          source_notes: string | null
          type: Database["public"]["Enums"]["airspace_zone_type"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "airspace_zones"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      find_organization_by_invite_code: {
        Args: { code: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_marketplace_pilot_profile: {
        Args: { target_pilot_id: string }
        Returns: {
          avatar_url: string
          avg_rating: number
          bio: string
          business_hours: Json
          drone_models: string[]
          flight_modes: string[]
          full_name: string
          headline: string
          id: string
          is_verified_pilot: boolean
          my_contact_request_status: Database["public"]["Enums"]["contact_request_status"]
          professional_category: string
          review_count: number
          service_areas: string[]
          skills: string[]
          software: string[]
          specializations: string[]
          uav_categories: string[]
          years_experience: number
        }[]
      }
      get_pilot_contact_phone: {
        Args: { target_pilot_id: string }
        Returns: string
      }
      gettransactionid: { Args: never; Returns: unknown }
      is_dispatcher_admin: { Args: never; Returns: boolean }
      is_org_fleet_manager: {
        Args: { target_org_id: string }
        Returns: boolean
      }
      is_same_org: { Args: { target_org_id: string }; Returns: boolean }
      longtransactionsenabled: { Args: never; Returns: boolean }
      marketplace_freelancers: {
        Args: { eligible_plan_codes: string[] }
        Returns: {
          avatar_url: string
          avg_rating: number
          bio: string
          business_hours: Json
          full_name: string
          headline: string
          id: string
          is_verified_pilot: boolean
          my_contact_request_status: Database["public"]["Enums"]["contact_request_status"]
          professional_category: string
          review_count: number
          service_areas: string[]
          skills: string[]
          specializations: string[]
          years_experience: number
        }[]
      }
      my_accepted_engagements: {
        Args: never
        Returns: {
          decided_at: string
          id: string
          pilot_avatar_url: string
          pilot_full_name: string
          pilot_id: string
        }[]
      }
      overlapping_flight_requests: {
        Args: { target_id: string }
        Returns: {
          end_time: string
          full_name: string
          id: string
          org_id: string
          org_name: string
          start_time: string
          status: Database["public"]["Enums"]["flight_request_status"]
          user_id: string
        }[]
      }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      sweep_expiring_licenses: { Args: never; Returns: number }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      aip_zone_kind:
        | "CTR"
        | "ATZ"
        | "TMA"
        | "CTA"
        | "RESTRICTED"
        | "DANGER"
        | "PROHIBITED"
      airspace_zone_type:
        | "CTR"
        | "FIRING_ZONE"
        | "RESTRICTED_AREA"
        | "NATURE_RESERVE"
      api_layer:
        | "map"
        | "zones"
        | "actions"
        | "live_ops"
        | "map_embed"
        | "marketplace_embed"
      battery_health_status:
        | "healthy"
        | "degraded"
        | "replace_soon"
        | "condemned"
      contact_request_status: "pending" | "accepted" | "declined"
      document_kind:
        | "pilot_license"
        | "drone_registration"
        | "insurance_certificate"
      document_ocr_status: "pending" | "processing" | "completed" | "failed"
      drone_status:
        | "operational"
        | "maintenance_required"
        | "grounded"
        | "retired"
      equipment_condition: "good" | "minor_issue" | "damaged"
      equipment_handoff_status: "checked_out" | "returned"
      flight_purpose:
        | "vlos_general"
        | "bvlos"
        | "photography"
        | "mapping_survey"
        | "agriculture_spraying"
        | "infrastructure_inspection"
        | "event_production"
        | "delivery"
        | "search_and_rescue"
        | "training"
        | "other"
      flight_request_status:
        | "draft"
        | "auto_cleared"
        | "pending_dispatcher"
        | "submitted_to_iaf"
        | "notam_published"
        | "rejected"
        | "completed"
        | "cancelled"
      flight_request_type: "basic_auto_100m" | "manual_notam_bubble"
      government_validation_entity:
        | "drone_registration"
        | "pilot_license"
        | "special_authorization"
      government_validation_status:
        | "not_configured"
        | "pending"
        | "verified"
        | "rejected"
        | "error"
      inventory_item_category:
        | "propeller"
        | "battery"
        | "charger"
        | "gimbal"
        | "other"
      license_status: "active" | "expiring_soon" | "expired"
      license_type: "hobby" | "commercial_25kg" | "heavy_2000kg"
      lms_course_id: "hobby_exam" | "commercial_25kg" | "heavy_2000kg"
      maintenance_entry_kind:
        | "inspection"
        | "repair"
        | "part_replacement"
        | "other"
      notification_kind:
        | "license_expiring"
        | "notam_published"
        | "inspection_required"
        | "battery_wear"
        | "org_membership_requested"
        | "org_membership_decided"
        | "low_inventory"
        | "contact_request_received"
        | "contact_request_decided"
        | "pilot_review_received"
      org_membership_status: "pending" | "active" | "rejected" | "removed"
      special_authorization_status: "pending_payment" | "active" | "expired"
      user_role:
        | "pilot_hobby"
        | "pilot_pro"
        | "fleet_manager"
        | "dispatcher_admin"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
          versioning_status: string
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
          versioning_status?: string
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
          versioning_status?: string
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          archived_at: string | null
          bucket_id: string | null
          created_at: string | null
          id: string
          is_delete_marker: boolean
          is_versioned: boolean
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          archived_at?: string | null
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          is_delete_marker?: boolean
          is_versioned?: boolean
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          archived_at?: string | null
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          is_delete_marker?: boolean
          is_versioned?: boolean
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      aip_zone_kind: [
        "CTR",
        "ATZ",
        "TMA",
        "CTA",
        "RESTRICTED",
        "DANGER",
        "PROHIBITED",
      ],
      airspace_zone_type: [
        "CTR",
        "FIRING_ZONE",
        "RESTRICTED_AREA",
        "NATURE_RESERVE",
      ],
      api_layer: [
        "map",
        "zones",
        "actions",
        "live_ops",
        "map_embed",
        "marketplace_embed",
      ],
      battery_health_status: [
        "healthy",
        "degraded",
        "replace_soon",
        "condemned",
      ],
      contact_request_status: ["pending", "accepted", "declined"],
      document_kind: [
        "pilot_license",
        "drone_registration",
        "insurance_certificate",
      ],
      document_ocr_status: ["pending", "processing", "completed", "failed"],
      drone_status: [
        "operational",
        "maintenance_required",
        "grounded",
        "retired",
      ],
      equipment_condition: ["good", "minor_issue", "damaged"],
      equipment_handoff_status: ["checked_out", "returned"],
      flight_purpose: [
        "vlos_general",
        "bvlos",
        "photography",
        "mapping_survey",
        "agriculture_spraying",
        "infrastructure_inspection",
        "event_production",
        "delivery",
        "search_and_rescue",
        "training",
        "other",
      ],
      flight_request_status: [
        "draft",
        "auto_cleared",
        "pending_dispatcher",
        "submitted_to_iaf",
        "notam_published",
        "rejected",
        "completed",
        "cancelled",
      ],
      flight_request_type: ["basic_auto_100m", "manual_notam_bubble"],
      government_validation_entity: [
        "drone_registration",
        "pilot_license",
        "special_authorization",
      ],
      government_validation_status: [
        "not_configured",
        "pending",
        "verified",
        "rejected",
        "error",
      ],
      inventory_item_category: [
        "propeller",
        "battery",
        "charger",
        "gimbal",
        "other",
      ],
      license_status: ["active", "expiring_soon", "expired"],
      license_type: ["hobby", "commercial_25kg", "heavy_2000kg"],
      lms_course_id: ["hobby_exam", "commercial_25kg", "heavy_2000kg"],
      maintenance_entry_kind: [
        "inspection",
        "repair",
        "part_replacement",
        "other",
      ],
      notification_kind: [
        "license_expiring",
        "notam_published",
        "inspection_required",
        "battery_wear",
        "org_membership_requested",
        "org_membership_decided",
        "low_inventory",
        "contact_request_received",
        "contact_request_decided",
        "pilot_review_received",
      ],
      org_membership_status: ["pending", "active", "rejected", "removed"],
      special_authorization_status: ["pending_payment", "active", "expired"],
      user_role: [
        "pilot_hobby",
        "pilot_pro",
        "fleet_manager",
        "dispatcher_admin",
      ],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const

export type UserRole = Enums<"user_role">
export type LmsCourseId = Enums<"lms_course_id">
export type AirspaceZoneType = Enums<"airspace_zone_type">
export type AipZoneKind = Enums<"aip_zone_kind">
export type SpecialAuthorizationStatus = Enums<"special_authorization_status">
export type GovernmentValidationEntity = Enums<"government_validation_entity">
export type GovernmentValidationStatus = Enums<"government_validation_status">
export type FlightRequestStatus = Enums<"flight_request_status">
export type ApiLayer = Enums<"api_layer">
export type FlightPurpose = Enums<"flight_purpose">
