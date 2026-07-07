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
          comentario: string | null
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
          comentario?: string | null
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
          comentario?: string | null
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
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          nome: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          slug?: string | null
          updated_at?: string
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
          is_team: boolean
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
          is_team?: boolean
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
          is_team?: boolean
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
          whatsapp_group_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          token: string
          tournament_id: string
          whatsapp_group_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          token?: string
          tournament_id?: string
          whatsapp_group_url?: string | null
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
          kind: string
          mode: string
          per_group: number | null
          rodada: number | null
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
          kind?: string
          mode: string
          per_group?: number | null
          rodada?: number | null
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
          kind?: string
          mode?: string
          per_group?: number | null
          rodada?: number | null
          scheduled_at?: string
          status?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          is_captain: boolean
          member_email: string | null
          member_nick: string | null
          member_nome: string
          member_whatsapp: string | null
          position: number
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_captain?: boolean
          member_email?: string | null
          member_nick?: string | null
          member_nome: string
          member_whatsapp?: string | null
          position: number
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_captain?: boolean
          member_email?: string | null
          member_nick?: string | null
          member_nome?: string
          member_whatsapp?: string | null
          position?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          campeao_id: string | null
          created_at: string
          created_by: string
          data_inicio: string
          direct_per_group: number | null
          elimination_only: boolean
          id: string
          lower_score_wins: boolean
          max_participants: number | null
          modalidade: string
          nome: string
          numero_rodadas: number | null
          organization_id: string
          regulamento: string | null
          repescagem_enabled: boolean
          repescagem_total: number | null
          updated_at: string
        }
        Insert: {
          campeao_id?: string | null
          created_at?: string
          created_by: string
          data_inicio: string
          direct_per_group?: number | null
          elimination_only?: boolean
          id?: string
          lower_score_wins?: boolean
          max_participants?: number | null
          modalidade?: string
          nome: string
          numero_rodadas?: number | null
          organization_id: string
          regulamento?: string | null
          repescagem_enabled?: boolean
          repescagem_total?: number | null
          updated_at?: string
        }
        Update: {
          campeao_id?: string | null
          created_at?: string
          created_by?: string
          data_inicio?: string
          direct_per_group?: number | null
          elimination_only?: boolean
          id?: string
          lower_score_wins?: boolean
          max_participants?: number | null
          modalidade?: string
          nome?: string
          numero_rodadas?: number | null
          organization_id?: string
          regulamento?: string | null
          repescagem_enabled?: boolean
          repescagem_total?: number | null
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
          {
            foreignKeyName: "tournaments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      can_access_tournament: { Args: { _t: string }; Returns: boolean }
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
          is_team: boolean
          nick_playroom: string
          nome_completo: string
          tournament_id: string
        }[]
      }
      get_upcoming_matches_for_reminder: {
        Args: { _minutes_before?: number; _window_minutes?: number }
        Returns: {
          id: string
        }[]
      }
      has_org_role: {
        Args: {
          _org: string
          _roles: Database["public"]["Enums"]["org_role"][]
          _user: string
        }
        Returns: boolean
      }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
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
      register_team_via_token: {
        Args: {
          _comentario: string
          _p1_email: string
          _p1_is_captain?: boolean
          _p1_nick: string
          _p1_nome: string
          _p1_whatsapp: string
          _p2_email: string
          _p2_is_captain?: boolean
          _p2_nick: string
          _p2_nome: string
          _p2_whatsapp: string
          _preferencia_horarios: string
          _team_name: string
          _token: string
        }
        Returns: string
      }
      unaccent: { Args: { "": string }; Returns: string }
      validate_registration_token: {
        Args: { _token: string }
        Returns: {
          expires_at: string
          modalidade: string
          regulamento: string
          tournament_id: string
          tournament_name: string
          whatsapp_group_url: string
        }[]
      }
    }
    Enums: {
      org_role: "owner" | "admin" | "member"
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
      org_role: ["owner", "admin", "member"],
    },
  },
} as const
