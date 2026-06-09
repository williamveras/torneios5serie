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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      match_reminders_sent: {
        Row: {
          id: string
          player_id: string
          schedule_id: string
          sent_at: string
        }
        Insert: {
          id?: string
          player_id: string
          schedule_id: string
          sent_at?: string
        }
        Update: {
          id?: string
          player_id?: string
          schedule_id?: string
          sent_at?: string
        }
        Relationships: []
      }
      match_results: {
        Row: {
          created_at: string
          fase: string
          grupo: string
          id: string
          penalidades: string
          player_id: string
          pontos_jogo: number
          pontos_mesa: number
          registered_by: string | null
          rodada: number
          tournament_id: string
        }
        Insert: {
          created_at?: string
          fase?: string
          grupo: string
          id?: string
          penalidades?: string
          player_id: string
          pontos_jogo?: number
          pontos_mesa?: number
          registered_by?: string | null
          rodada: number
          tournament_id: string
        }
        Update: {
          created_at?: string
          fase?: string
          grupo?: string
          id?: string
          penalidades?: string
          player_id?: string
          pontos_jogo?: number
          pontos_mesa?: number
          registered_by?: string | null
          rodada?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_results_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      match_schedule: {
        Row: {
          created_at: string
          data_partida: string | null
          grupo: string
          horario: string | null
          id: string
          observacao: string | null
          player1_id: string
          player2_id: string
          rodada: number | null
          tournament_id: string
        }
        Insert: {
          created_at?: string
          data_partida?: string | null
          grupo: string
          horario?: string | null
          id?: string
          observacao?: string | null
          player1_id: string
          player2_id: string
          rodada?: number | null
          tournament_id: string
        }
        Update: {
          created_at?: string
          data_partida?: string | null
          grupo?: string
          horario?: string | null
          id?: string
          observacao?: string | null
          player1_id?: string
          player2_id?: string
          rodada?: number | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_schedule_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_schedule_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_schedule_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_schedule_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_schedule_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      matchups: {
        Row: {
          bracket_slot: number | null
          created_at: string
          fase: string
          grupo: string
          id: string
          player1_id: string
          player2_id: string
          rodada: number | null
          tournament_id: string
        }
        Insert: {
          bracket_slot?: number | null
          created_at?: string
          fase?: string
          grupo: string
          id?: string
          player1_id: string
          player2_id: string
          rodada?: number | null
          tournament_id: string
        }
        Update: {
          bracket_slot?: number | null
          created_at?: string
          fase?: string
          grupo?: string
          id?: string
          player1_id?: string
          player2_id?: string
          rodada?: number | null
          tournament_id?: string
        }
        Relationships: []
      }
      phase_status: {
        Row: {
          created_at: string
          fase: string
          id: string
          status: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fase: string
          id?: string
          status?: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fase?: string
          id?: string
          status?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          comentario: string | null
          created_at: string
          eliminado: boolean
          email: string | null
          grupo: string | null
          id: string
          nick_playroom: string | null
          nome_completo: string
          preferencia_horarios: string | null
          tournament_id: string
          whatsapp: string | null
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          eliminado?: boolean
          email?: string | null
          grupo?: string | null
          id?: string
          nick_playroom?: string | null
          nome_completo: string
          preferencia_horarios?: string | null
          tournament_id: string
          whatsapp?: string | null
        }
        Update: {
          comentario?: string | null
          created_at?: string
          eliminado?: boolean
          email?: string | null
          grupo?: string | null
          id?: string
          nick_playroom?: string | null
          nome_completo?: string
          preferencia_horarios?: string | null
          tournament_id?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          nome: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
      registration_links: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          token: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          token: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          token?: string
          tournament_id?: string
        }
        Relationships: []
      }
      scheduled_draws: {
        Row: {
          created_at: string
          created_by: string | null
          error_message: string | null
          executed_at: string | null
          fase: string
          id: string
          mode: string
          scheduled_at: string
          status: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          executed_at?: string | null
          fase: string
          id?: string
          mode: string
          scheduled_at: string
          status?: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          executed_at?: string | null
          fase?: string
          id?: string
          mode?: string
          scheduled_at?: string
          status?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tournaments: {
        Row: {
          campeao_id: string | null
          created_at: string
          created_by: string
          data_inicio: string
          id: string
          nome: string
          numero_rodadas: number | null
          regulamento: string | null
          updated_at: string
        }
        Insert: {
          campeao_id?: string | null
          created_at?: string
          created_by: string
          data_inicio: string
          id?: string
          nome: string
          numero_rodadas?: number | null
          regulamento?: string | null
          updated_at?: string
        }
        Update: {
          campeao_id?: string | null
          created_at?: string
          created_by?: string
          data_inicio?: string
          id?: string
          nome?: string
          numero_rodadas?: number | null
          regulamento?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_campeao_id_fkey"
            columns: ["campeao_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_campeao_id_fkey"
            columns: ["campeao_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      players_public: {
        Row: {
          created_at: string | null
          grupo: string | null
          id: string | null
          nick_playroom: string | null
          nome_completo: string | null
          tournament_id: string | null
        }
        Insert: {
          created_at?: string | null
          grupo?: string | null
          id?: string | null
          nick_playroom?: string | null
          nome_completo?: string | null
          tournament_id?: string | null
        }
        Update: {
          created_at?: string | null
          grupo?: string | null
          id?: string | null
          nick_playroom?: string | null
          nome_completo?: string | null
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      execute_scheduled_draws: { Args: never; Returns: undefined }
      get_moderators_public: {
        Args: { _tournament_id: string }
        Returns: {
          nome: string
          user_id: string
        }[]
      }
      get_players_public: {
        Args: { _tournament_id: string }
        Returns: {
          grupo: string
          id: string
          nick_playroom: string
          nome_completo: string
          tournament_id: string
        }[]
      }
      register_player_via_token: {
        Args: {
          _comentario: string
          _email: string
          _nick_playroom: string
          _nome_completo: string
          _preferencia_horarios: string
          _token: string
          _whatsapp: string
        }
        Returns: string
      }
      validate_registration_token: {
        Args: { _token: string }
        Returns: {
          expires_at: string
          tournament_id: string
          tournament_name: string
        }[]
      }
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
