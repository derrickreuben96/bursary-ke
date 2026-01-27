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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bursary_adverts: {
        Row: {
          budget_amount: number | null
          county: string
          created_at: string | null
          deadline: string
          description: string | null
          id: string
          is_active: boolean | null
          required_documents: string[] | null
          title: string
          updated_at: string | null
          venues: Json | null
          ward: string | null
        }
        Insert: {
          budget_amount?: number | null
          county: string
          created_at?: string | null
          deadline: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          required_documents?: string[] | null
          title: string
          updated_at?: string | null
          venues?: Json | null
          ward?: string | null
        }
        Update: {
          budget_amount?: number | null
          county?: string
          created_at?: string | null
          deadline?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          required_documents?: string[] | null
          title?: string
          updated_at?: string | null
          venues?: Json | null
          ward?: string | null
        }
        Relationships: []
      }
      bursary_applications: {
        Row: {
          advert_id: string | null
          ai_decision_reason: string | null
          allocated_amount: number | null
          allocation_date: string | null
          class_form: string | null
          created_at: string
          duplicate_of: string | null
          ecitizen_ref: string | null
          household_dependents: number
          household_income: number
          id: string
          institution_name: string
          is_duplicate: boolean | null
          parent_county: string
          parent_email: string | null
          parent_full_name: string
          parent_national_id: string
          parent_phone: string
          poverty_score: number
          poverty_tier: Database["public"]["Enums"]["poverty_tier"]
          reviewed_at: string | null
          reviewed_by: string | null
          sms_consent: boolean
          sms_sent: boolean | null
          sms_sent_at: string | null
          status: Database["public"]["Enums"]["application_status"]
          student_full_name: string
          student_id: string | null
          student_type: Database["public"]["Enums"]["student_type"]
          tracking_number: string
          updated_at: string
          year_of_study: string | null
        }
        Insert: {
          advert_id?: string | null
          ai_decision_reason?: string | null
          allocated_amount?: number | null
          allocation_date?: string | null
          class_form?: string | null
          created_at?: string
          duplicate_of?: string | null
          ecitizen_ref?: string | null
          household_dependents: number
          household_income: number
          id?: string
          institution_name: string
          is_duplicate?: boolean | null
          parent_county: string
          parent_email?: string | null
          parent_full_name: string
          parent_national_id: string
          parent_phone: string
          poverty_score: number
          poverty_tier: Database["public"]["Enums"]["poverty_tier"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          sms_consent?: boolean
          sms_sent?: boolean | null
          sms_sent_at?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          student_full_name: string
          student_id?: string | null
          student_type: Database["public"]["Enums"]["student_type"]
          tracking_number: string
          updated_at?: string
          year_of_study?: string | null
        }
        Update: {
          advert_id?: string | null
          ai_decision_reason?: string | null
          allocated_amount?: number | null
          allocation_date?: string | null
          class_form?: string | null
          created_at?: string
          duplicate_of?: string | null
          ecitizen_ref?: string | null
          household_dependents?: number
          household_income?: number
          id?: string
          institution_name?: string
          is_duplicate?: boolean | null
          parent_county?: string
          parent_email?: string | null
          parent_full_name?: string
          parent_national_id?: string
          parent_phone?: string
          poverty_score?: number
          poverty_tier?: Database["public"]["Enums"]["poverty_tier"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          sms_consent?: boolean
          sms_sent?: boolean | null
          sms_sent_at?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          student_full_name?: string
          student_id?: string | null
          student_type?: Database["public"]["Enums"]["student_type"]
          tracking_number?: string
          updated_at?: string
          year_of_study?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bursary_applications_advert_id_fkey"
            columns: ["advert_id"]
            isOneToOne: false
            referencedRelation: "bursary_adverts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bursary_applications_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "bursary_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bursary_applications_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "bursary_applications_treasury"
            referencedColumns: ["id"]
          },
        ]
      }
      bursary_subscriptions: {
        Row: {
          county: string
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          county: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          county?: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          phone?: string | null
          updated_at?: string | null
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
          role?: Database["public"]["Enums"]["app_role"]
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
      bursary_applications_treasury: {
        Row: {
          allocated_amount: number | null
          allocation_date: string | null
          county: string | null
          created_at: string | null
          ecitizen_ref: string | null
          id: string | null
          institution_name: string | null
          status: Database["public"]["Enums"]["application_status"] | null
          student_name_masked: string | null
          student_type: Database["public"]["Enums"]["student_type"] | null
          tracking_number: string | null
          updated_at: string | null
        }
        Insert: {
          allocated_amount?: number | null
          allocation_date?: string | null
          county?: never
          created_at?: string | null
          ecitizen_ref?: string | null
          id?: string | null
          institution_name?: string | null
          status?: Database["public"]["Enums"]["application_status"] | null
          student_name_masked?: never
          student_type?: Database["public"]["Enums"]["student_type"] | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Update: {
          allocated_amount?: number | null
          allocation_date?: string | null
          county?: never
          created_at?: string | null
          ecitizen_ref?: string | null
          id?: string | null
          institution_name?: string | null
          status?: Database["public"]["Enums"]["application_status"] | null
          student_name_masked?: never
          student_type?: Database["public"]["Enums"]["student_type"] | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      generate_tracking_number: { Args: never; Returns: string }
      get_treasury_applications: {
        Args: never
        Returns: {
          allocated_amount: number
          allocation_date: string
          county: string
          created_at: string
          ecitizen_ref: string
          id: string
          institution_name: string
          status: string
          student_name_masked: string
          student_type: string
          tracking_number: string
          updated_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "county_treasury" | "county_commissioner"
      application_status:
        | "received"
        | "review"
        | "verification"
        | "approved"
        | "rejected"
        | "disbursed"
      poverty_tier: "Low" | "Medium" | "High"
      student_type: "secondary" | "university"
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
      app_role: ["admin", "user", "county_treasury", "county_commissioner"],
      application_status: [
        "received",
        "review",
        "verification",
        "approved",
        "rejected",
        "disbursed",
      ],
      poverty_tier: ["Low", "Medium", "High"],
      student_type: ["secondary", "university"],
    },
  },
} as const
