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
      cities: {
        Row: {
          country_code: string
          created_at: string
          id: string
          is_active: boolean
          is_launch_city: boolean
          latitude: number | null
          longitude: number | null
          name: string
          search_terms: string | null
          slug: string
          sort_order: number
          state: string | null
          state_code: string | null
        }
        Insert: {
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_launch_city?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          search_terms?: string | null
          slug: string
          sort_order?: number
          state?: string | null
          state_code?: string | null
        }
        Update: {
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_launch_city?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          search_terms?: string | null
          slug?: string
          sort_order?: number
          state?: string | null
          state_code?: string | null
        }
        Relationships: []
      }
      connections: {
        Row: {
          created_at: string
          ended_at: string | null
          ended_by: string | null
          id: string
          member_a: string
          member_a_read_at: string | null
          member_b: string
          member_b_read_at: string | null
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          member_a: string
          member_a_read_at?: string | null
          member_b: string
          member_b_read_at?: string | null
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          member_a?: string
          member_a_read_at?: string | null
          member_b?: string
          member_b_read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connections_ended_by_fkey"
            columns: ["ended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_member_a_fkey"
            columns: ["member_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_member_b_fkey"
            columns: ["member_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlements: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          kind: Database["public"]["Enums"]["entitlement_kind"]
          tier: Database["public"]["Enums"]["membership_tier"]
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          kind: Database["public"]["Enums"]["entitlement_kind"]
          tier: Database["public"]["Enums"]["membership_tier"]
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          kind?: Database["public"]["Enums"]["entitlement_kind"]
          tier?: Database["public"]["Enums"]["membership_tier"]
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      languages: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      member_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_interests: {
        Row: {
          created_at: string
          from_id: string
          kind: Database["public"]["Enums"]["interest_kind"]
          to_id: string
        }
        Insert: {
          created_at?: string
          from_id: string
          kind: Database["public"]["Enums"]["interest_kind"]
          to_id: string
        }
        Update: {
          created_at?: string
          from_id?: string
          kind?: Database["public"]["Enums"]["interest_kind"]
          to_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_interests_from_id_fkey"
            columns: ["from_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_interests_to_id_fkey"
            columns: ["to_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_reports: {
        Row: {
          created_at: string
          description: string | null
          id: string
          reason_code: Database["public"]["Enums"]["report_reason"]
          reported_id: string
          reporter_id: string
          reviewed_at: string | null
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          reason_code?: Database["public"]["Enums"]["report_reason"]
          reported_id: string
          reporter_id: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          reason_code?: Database["public"]["Enums"]["report_reason"]
          reported_id?: string
          reporter_id?: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "member_reports_reported_id_fkey"
            columns: ["reported_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_reverts: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          reverted_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          reverted_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          reverted_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_reverts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_reverts_reverted_id_fkey"
            columns: ["reverted_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          code: string
          created_at: string
          currency: string
          description: string | null
          id: string
          intro_period_months: number | null
          intro_price_paise: number | null
          is_active: boolean
          is_recurring: boolean
          name: string
          period_months: number
          price_paise: number
          sort_order: number
          tier: Database["public"]["Enums"]["membership_tier"]
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          intro_period_months?: number | null
          intro_price_paise?: number | null
          is_active?: boolean
          is_recurring?: boolean
          name: string
          period_months: number
          price_paise: number
          sort_order?: number
          tier?: Database["public"]["Enums"]["membership_tier"]
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          intro_period_months?: number | null
          intro_price_paise?: number | null
          is_active?: boolean
          is_recurring?: boolean
          name?: string
          period_months?: number
          price_paise?: number
          sort_order?: number
          tier?: Database["public"]["Enums"]["membership_tier"]
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          connection_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          connection_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          connection_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_languages: {
        Row: {
          created_at: string
          language_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          language_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          language_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_languages_language_id_fkey"
            columns: ["language_id"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_languages_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_photos: {
        Row: {
          created_at: string
          id: string
          position: number
          profile_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          profile_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          profile_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_photos_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          about: string | null
          city_id: string | null
          created_at: string
          date_of_birth: string | null
          first_name: string | null
          gender: Database["public"]["Enums"]["gender"] | null
          id: string
          languages_undisclosed: boolean
          looking_for: string | null
          onboarding_stage: Database["public"]["Enums"]["onboarding_stage"]
          other_city: string | null
          phone_verified_at: string | null
          relationship_status:
            | Database["public"]["Enums"]["relationship_status"]
            | null
          seeking: Database["public"]["Enums"]["gender"][] | null
          updated_at: string
        }
        Insert: {
          about?: string | null
          city_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string | null
          gender?: Database["public"]["Enums"]["gender"] | null
          id: string
          languages_undisclosed?: boolean
          looking_for?: string | null
          onboarding_stage?: Database["public"]["Enums"]["onboarding_stage"]
          other_city?: string | null
          phone_verified_at?: string | null
          relationship_status?:
            | Database["public"]["Enums"]["relationship_status"]
            | null
          seeking?: Database["public"]["Enums"]["gender"][] | null
          updated_at?: string
        }
        Update: {
          about?: string | null
          city_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string | null
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          languages_undisclosed?: boolean
          looking_for?: string | null
          onboarding_stage?: Database["public"]["Enums"]["onboarding_stage"]
          other_city?: string | null
          phone_verified_at?: string | null
          relationship_status?:
            | Database["public"]["Enums"]["relationship_status"]
            | null
          seeking?: Database["public"]["Enums"]["gender"][] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at: string | null
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          ended_at: string | null
          id: string
          is_introductory: boolean
          periods_billed: number
          plan_id: string
          profile_id: string
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_subscription_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          cancel_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          ended_at?: string | null
          id?: string
          is_introductory?: boolean
          periods_billed?: number
          plan_id: string
          profile_id: string
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_subscription_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          cancel_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          ended_at?: string | null
          id?: string
          is_introductory?: boolean
          periods_billed?: number
          plan_id?: string
          profile_id?: string
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_subscription_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          city: string
          created_at: string
          email: string
          id: string
          list: string
          name: string
        }
        Insert: {
          city: string
          created_at?: string
          email: string
          id?: string
          list?: string
          name: string
        }
        Update: {
          city?: string
          created_at?: string
          email?: string
          id?: string
          list?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      city_coverage: {
        Args: never
        Returns: {
          city_count: number
          state_count: number
        }[]
      }
      delete_my_account: { Args: never; Returns: undefined }
      record_auth_event: {
        Args: {
          event_name: string
          masked_identifier?: string | null
          reason?: string | null
        }
        Returns: undefined
      }
      discover_members: {
        Args: {
          city_ids?: string[]
          language_ids?: string[]
          max_age?: number
          max_results?: number
          min_age?: number
          page_offset?: number
          relationship_statuses?: Database["public"]["Enums"]["relationship_status"][]
        }
        Returns: Database["public"]["CompositeTypes"]["member_card"][]
        SetofOptions: {
          from: "*"
          to: "member_card"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      express_interest: {
        Args: {
          decision?: Database["public"]["Enums"]["interest_kind"]
          target_id: string
        }
        Returns: string
      }
      genders_are_compatible: {
        Args: {
          candidate_gender: Database["public"]["Enums"]["gender"]
          candidate_seeking: Database["public"]["Enums"]["gender"][]
          viewer_gender: Database["public"]["Enums"]["gender"]
          viewer_seeking: Database["public"]["Enums"]["gender"][]
        }
        Returns: boolean
      }
      home_summary: {
        Args: never
        Returns: {
          interests_received: number
          introductions: number
          new_connections: number
          unread_conversations: number
        }[]
      }
      interests_received: {
        Args: never
        Returns: Database["public"]["CompositeTypes"]["member_card"][]
        SetofOptions: {
          from: "*"
          to: "member_card"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      interests_received_count: { Args: never; Returns: number }
      mark_conversation_read: {
        Args: { connection_id: string }
        Returns: undefined
      }
      member_photos: {
        Args: { member_id: string }
        Returns: {
          photo_position: number
          storage_path: string
        }[]
      }
      member_profile: {
        Args: { member_id: string }
        Returns: Database["public"]["CompositeTypes"]["member_card"][]
        SetofOptions: {
          from: "*"
          to: "member_card"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      my_conversations: {
        Args: never
        Returns: Database["public"]["CompositeTypes"]["conversation_row"][]
        SetofOptions: {
          from: "*"
          to: "conversation_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      revert_last_pass: { Args: never; Returns: string }
      reverts_remaining: { Args: never; Returns: number }
      search_cities: {
        Args: { max_results?: number; query: string }
        Returns: {
          id: string
          is_launch_city: boolean
          name: string
          state: string
          state_code: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      entitlement_kind: "boolean" | "number"
      gender: "woman" | "man" | "non_binary" | "prefer_not_to_say"
      interest_kind: "interested" | "passed"
      membership_tier: "free" | "premium"
      onboarding_stage:
        | "authenticated"
        | "phone_verified"
        | "onboarding_started"
        | "onboarding_completed"
      payment_provider:
        | "none"
        | "razorpay"
        | "stripe"
        | "apple_app_store"
        | "google_play"
      relationship_status: "divorced" | "separated" | "widowed"
      report_reason:
        | "fake_profile"
        | "harassment"
        | "inappropriate_content"
        | "scam"
        | "incorrect_relationship_status"
        | "other"
      report_status: "received" | "reviewing" | "actioned" | "dismissed"
      subscription_status:
        | "pending"
        | "trialing"
        | "active"
        | "past_due"
        | "cancelled"
        | "expired"
    }
    CompositeTypes: {
      conversation_row: {
        connection_id: string | null
        member: Database["public"]["CompositeTypes"]["member_card"] | null
        last_message: string | null
        last_message_at: string | null
        last_message_from_me: boolean | null
        unread: boolean | null
        ended_at: string | null
        ended_by_me: boolean | null
      }
      member_card: {
        id: string | null
        first_name: string | null
        age: number | null
        city: string | null
        state: string | null
        relationship_status:
          | Database["public"]["Enums"]["relationship_status"]
          | null
        gender: Database["public"]["Enums"]["gender"] | null
        languages: string[] | null
        about: string | null
        looking_for: string | null
        photo_path: string | null
        photo_count: number | null
        phone_verified: boolean | null
        email_verified: boolean | null
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      entitlement_kind: ["boolean", "number"],
      gender: ["woman", "man", "non_binary", "prefer_not_to_say"],
      interest_kind: ["interested", "passed"],
      membership_tier: ["free", "premium"],
      onboarding_stage: [
        "authenticated",
        "phone_verified",
        "onboarding_started",
        "onboarding_completed",
      ],
      payment_provider: [
        "none",
        "razorpay",
        "stripe",
        "apple_app_store",
        "google_play",
      ],
      relationship_status: ["divorced", "separated", "widowed"],
      report_reason: [
        "fake_profile",
        "harassment",
        "inappropriate_content",
        "scam",
        "incorrect_relationship_status",
        "other",
      ],
      report_status: ["received", "reviewing", "actioned", "dismissed"],
      subscription_status: [
        "pending",
        "trialing",
        "active",
        "past_due",
        "cancelled",
        "expired",
      ],
    },
  },
} as const
