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
      profiles: {
        Row: {
          city_id: string | null
          created_at: string
          date_of_birth: string | null
          first_name: string | null
          gender: Database["public"]["Enums"]["gender"] | null
          id: string
          languages_undisclosed: boolean
          onboarding_stage: Database["public"]["Enums"]["onboarding_stage"]
          other_city: string | null
          phone_verified_at: string | null
          relationship_status:
            | Database["public"]["Enums"]["relationship_status"]
            | null
          updated_at: string
        }
        Insert: {
          city_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string | null
          gender?: Database["public"]["Enums"]["gender"] | null
          id: string
          languages_undisclosed?: boolean
          onboarding_stage?: Database["public"]["Enums"]["onboarding_stage"]
          other_city?: string | null
          phone_verified_at?: string | null
          relationship_status?:
            | Database["public"]["Enums"]["relationship_status"]
            | null
          updated_at?: string
        }
        Update: {
          city_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string | null
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          languages_undisclosed?: boolean
          onboarding_stage?: Database["public"]["Enums"]["onboarding_stage"]
          other_city?: string | null
          phone_verified_at?: string | null
          relationship_status?:
            | Database["public"]["Enums"]["relationship_status"]
            | null
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
      subscription_status:
        | "pending"
        | "trialing"
        | "active"
        | "past_due"
        | "cancelled"
        | "expired"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      entitlement_kind: ["boolean", "number"],
      gender: ["woman", "man", "non_binary", "prefer_not_to_say"],
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
