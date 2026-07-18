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
      ai_allocation_runs: {
        Row: {
          advert_id: string
          applicants_count: number
          approved_count: number
          id: string
          rejected_count: number
          run_at: string
          run_by: string | null
          summary: Json
          total_allocated: number
          total_budget: number
        }
        Insert: {
          advert_id: string
          applicants_count?: number
          approved_count?: number
          id?: string
          rejected_count?: number
          run_at?: string
          run_by?: string | null
          summary?: Json
          total_allocated?: number
          total_budget?: number
        }
        Update: {
          advert_id?: string
          applicants_count?: number
          approved_count?: number
          id?: string
          rejected_count?: number
          run_at?: string
          run_by?: string | null
          summary?: Json
          total_allocated?: number
          total_budget?: number
        }
        Relationships: []
      }
      allocation_cycles: {
        Row: {
          advert_id: string | null
          completed_at: string | null
          county: string
          created_at: string
          cycle_name: string
          fiscal_year: string
          id: string
          started_at: string
          total_allocated: number | null
          total_applicants: number | null
          total_approved: number | null
          total_budget: number | null
        }
        Insert: {
          advert_id?: string | null
          completed_at?: string | null
          county: string
          created_at?: string
          cycle_name: string
          fiscal_year: string
          id?: string
          started_at?: string
          total_allocated?: number | null
          total_applicants?: number | null
          total_approved?: number | null
          total_budget?: number | null
        }
        Update: {
          advert_id?: string | null
          completed_at?: string | null
          county?: string
          created_at?: string
          cycle_name?: string
          fiscal_year?: string
          id?: string
          started_at?: string
          total_allocated?: number | null
          total_applicants?: number | null
          total_approved?: number | null
          total_budget?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "allocation_cycles_advert_id_fkey"
            columns: ["advert_id"]
            isOneToOne: false
            referencedRelation: "bursary_adverts"
            referencedColumns: ["id"]
          },
        ]
      }
      applicant_history: {
        Row: {
          ai_score: number | null
          allocated_amount: number | null
          application_id: string | null
          county: string
          created_at: string
          cycle_id: string | null
          funding_status: string
          id: string
          national_id: string
          phone_number: string | null
          red_flag: boolean
          red_flag_reason: string | null
          ward: string | null
        }
        Insert: {
          ai_score?: number | null
          allocated_amount?: number | null
          application_id?: string | null
          county: string
          created_at?: string
          cycle_id?: string | null
          funding_status: string
          id?: string
          national_id: string
          phone_number?: string | null
          red_flag?: boolean
          red_flag_reason?: string | null
          ward?: string | null
        }
        Update: {
          ai_score?: number | null
          allocated_amount?: number | null
          application_id?: string | null
          county?: string
          created_at?: string
          cycle_id?: string | null
          funding_status?: string
          id?: string
          national_id?: string
          phone_number?: string | null
          red_flag?: boolean
          red_flag_reason?: string | null
          ward?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applicant_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "bursary_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicant_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "bursary_applications_commissioner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicant_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "bursary_applications_treasury"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicant_history_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "allocation_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      application_decision_log: {
        Row: {
          advert_id: string | null
          decided_at: string
          decided_by: string | null
          decision: string
          disability_score: number | null
          fraud_score: number | null
          id: string
          parent_application_id: string | null
          poverty_score: number | null
          quota_category: string | null
          rank_in_pipeline: number | null
          reason_code: string | null
          snapshot: Json
          student_beneficiary_id: string
        }
        Insert: {
          advert_id?: string | null
          decided_at?: string
          decided_by?: string | null
          decision: string
          disability_score?: number | null
          fraud_score?: number | null
          id?: string
          parent_application_id?: string | null
          poverty_score?: number | null
          quota_category?: string | null
          rank_in_pipeline?: number | null
          reason_code?: string | null
          snapshot?: Json
          student_beneficiary_id: string
        }
        Update: {
          advert_id?: string | null
          decided_at?: string
          decided_by?: string | null
          decision?: string
          disability_score?: number | null
          fraud_score?: number | null
          id?: string
          parent_application_id?: string | null
          poverty_score?: number | null
          quota_category?: string | null
          rank_in_pipeline?: number | null
          reason_code?: string | null
          snapshot?: Json
          student_beneficiary_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_decision_log_advert_id_fkey"
            columns: ["advert_id"]
            isOneToOne: false
            referencedRelation: "bursary_adverts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_decision_log_parent_application_id_fkey"
            columns: ["parent_application_id"]
            isOneToOne: false
            referencedRelation: "parent_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_decision_log_student_beneficiary_id_fkey"
            columns: ["student_beneficiary_id"]
            isOneToOne: false
            referencedRelation: "student_beneficiaries"
            referencedColumns: ["id"]
          },
        ]
      }
      application_status_history: {
        Row: {
          application_id: string
          changed_at: string
          changed_by: string | null
          from_status: string | null
          id: string
          notes: string | null
          to_status: string
        }
        Insert: {
          application_id: string
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          notes?: string | null
          to_status: string
        }
        Update: {
          application_id?: string
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          notes?: string | null
          to_status?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          actor_role: string | null
          actor_user_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          ip: string | null
          user_agent: string | null
        }
        Insert: {
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_runs: {
        Row: {
          deployment_ref: string | null
          details: Json
          duration_ms: number
          failed: number
          id: string
          passed: number
          run_at: string
          status: string
          suite: string
          total: number
        }
        Insert: {
          deployment_ref?: string | null
          details?: Json
          duration_ms?: number
          failed?: number
          id?: string
          passed?: number
          run_at?: string
          status: string
          suite: string
          total?: number
        }
        Update: {
          deployment_ref?: string | null
          details?: Json
          duration_ms?: number
          failed?: number
          id?: string
          passed?: number
          run_at?: string
          status?: string
          suite?: string
          total?: number
        }
        Relationships: []
      }
      bursary_adverts: {
        Row: {
          budget_amount: number | null
          closed_at: string | null
          county: string
          created_at: string | null
          deadline: string
          description: string | null
          high_school_budget_cap: number | null
          high_school_quota_slots: number | null
          higher_education_budget_cap: number | null
          higher_education_quota_slots: number | null
          id: string
          is_active: boolean | null
          max_award_per_student: number | null
          max_slots: number | null
          min_award_per_student: number | null
          min_beneficiaries: number | null
          required_documents: string[] | null
          title: string
          total_slots: number | null
          updated_at: string | null
          venues: Json | null
          ward: string | null
        }
        Insert: {
          budget_amount?: number | null
          closed_at?: string | null
          county: string
          created_at?: string | null
          deadline: string
          description?: string | null
          high_school_budget_cap?: number | null
          high_school_quota_slots?: number | null
          higher_education_budget_cap?: number | null
          higher_education_quota_slots?: number | null
          id?: string
          is_active?: boolean | null
          max_award_per_student?: number | null
          max_slots?: number | null
          min_award_per_student?: number | null
          min_beneficiaries?: number | null
          required_documents?: string[] | null
          title: string
          total_slots?: number | null
          updated_at?: string | null
          venues?: Json | null
          ward?: string | null
        }
        Update: {
          budget_amount?: number | null
          closed_at?: string | null
          county?: string
          created_at?: string | null
          deadline?: string
          description?: string | null
          high_school_budget_cap?: number | null
          high_school_quota_slots?: number | null
          higher_education_budget_cap?: number | null
          higher_education_quota_slots?: number | null
          id?: string
          is_active?: boolean | null
          max_award_per_student?: number | null
          max_slots?: number | null
          min_award_per_student?: number | null
          min_beneficiaries?: number | null
          required_documents?: string[] | null
          title?: string
          total_slots?: number | null
          updated_at?: string | null
          venues?: Json | null
          ward?: string | null
        }
        Relationships: []
      }
      bursary_applications: {
        Row: {
          advert_id: string
          ai_decision_reason: string | null
          allocated_amount: number | null
          allocation_date: string | null
          class_form: string | null
          created_at: string
          document_urls: Json | null
          duplicate_of: string | null
          ecitizen_ref: string | null
          fairness_priority_score: number | null
          fraud_risk_level: string | null
          historical_status: string | null
          household_dependents: number
          household_income: number
          id: string
          institution_name: string
          is_duplicate: boolean | null
          is_fairness_priority: boolean | null
          parent_county: string
          parent_email: string | null
          parent_full_name: string
          parent_national_id: string
          parent_phone: string
          parent_ward: string | null
          poverty_score: number
          poverty_tier: Database["public"]["Enums"]["poverty_tier"]
          released_to_treasury: boolean
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
          advert_id: string
          ai_decision_reason?: string | null
          allocated_amount?: number | null
          allocation_date?: string | null
          class_form?: string | null
          created_at?: string
          document_urls?: Json | null
          duplicate_of?: string | null
          ecitizen_ref?: string | null
          fairness_priority_score?: number | null
          fraud_risk_level?: string | null
          historical_status?: string | null
          household_dependents: number
          household_income: number
          id?: string
          institution_name: string
          is_duplicate?: boolean | null
          is_fairness_priority?: boolean | null
          parent_county: string
          parent_email?: string | null
          parent_full_name: string
          parent_national_id: string
          parent_phone: string
          parent_ward?: string | null
          poverty_score: number
          poverty_tier: Database["public"]["Enums"]["poverty_tier"]
          released_to_treasury?: boolean
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
          advert_id?: string
          ai_decision_reason?: string | null
          allocated_amount?: number | null
          allocation_date?: string | null
          class_form?: string | null
          created_at?: string
          document_urls?: Json | null
          duplicate_of?: string | null
          ecitizen_ref?: string | null
          fairness_priority_score?: number | null
          fraud_risk_level?: string | null
          historical_status?: string | null
          household_dependents?: number
          household_income?: number
          id?: string
          institution_name?: string
          is_duplicate?: boolean | null
          is_fairness_priority?: boolean | null
          parent_county?: string
          parent_email?: string | null
          parent_full_name?: string
          parent_national_id?: string
          parent_phone?: string
          parent_ward?: string | null
          poverty_score?: number
          poverty_tier?: Database["public"]["Enums"]["poverty_tier"]
          released_to_treasury?: boolean
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
            referencedRelation: "bursary_applications_commissioner"
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
      disbursements: {
        Row: {
          amount: number
          application_id: string | null
          completed_at: string | null
          county: string | null
          created_at: string
          id: string
          last_error: string | null
          parent_application_id: string | null
          payment_reference: string | null
          provider: string | null
          retry_count: number
          school_name: string | null
          status: string
          student_id: string | null
          triggered_at: string
          triggered_by: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          application_id?: string | null
          completed_at?: string | null
          county?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          parent_application_id?: string | null
          payment_reference?: string | null
          provider?: string | null
          retry_count?: number
          school_name?: string | null
          status?: string
          student_id?: string | null
          triggered_at?: string
          triggered_by?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          application_id?: string | null
          completed_at?: string | null
          county?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          parent_application_id?: string | null
          payment_reference?: string | null
          provider?: string | null
          retry_count?: number
          school_name?: string | null
          status?: string
          student_id?: string | null
          triggered_at?: string
          triggered_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      duplicate_detection: {
        Row: {
          applicant_identifier: string | null
          created_at: string
          id: string
          match_type: string
          matched_household_id: string | null
          matched_student_id: string | null
          parent_national_id: string | null
          resolution_notes: string | null
          resolved: boolean
        }
        Insert: {
          applicant_identifier?: string | null
          created_at?: string
          id?: string
          match_type: string
          matched_household_id?: string | null
          matched_student_id?: string | null
          parent_national_id?: string | null
          resolution_notes?: string | null
          resolved?: boolean
        }
        Update: {
          applicant_identifier?: string | null
          created_at?: string
          id?: string
          match_type?: string
          matched_household_id?: string | null
          matched_student_id?: string | null
          parent_national_id?: string | null
          resolution_notes?: string | null
          resolved?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_detection_matched_household_id_fkey"
            columns: ["matched_household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_detection_matched_student_id_fkey"
            columns: ["matched_student_id"]
            isOneToOne: false
            referencedRelation: "student_beneficiaries"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      erp_notifications: {
        Row: {
          ack_timestamp: string | null
          created_at: string
          delivery_status: string
          disbursement_id: string
          id: string
          last_error: string | null
          payload_json: Json
          retry_count: number
          school_name: string | null
          student_id: string | null
          updated_at: string
        }
        Insert: {
          ack_timestamp?: string | null
          created_at?: string
          delivery_status?: string
          disbursement_id: string
          id?: string
          last_error?: string | null
          payload_json?: Json
          retry_count?: number
          school_name?: string | null
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          ack_timestamp?: string | null
          created_at?: string
          delivery_status?: string
          disbursement_id?: string
          id?: string
          last_error?: string | null
          payload_json?: Json
          retry_count?: number
          school_name?: string | null
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_notifications_disbursement_id_fkey"
            columns: ["disbursement_id"]
            isOneToOne: false
            referencedRelation: "disbursements"
            referencedColumns: ["id"]
          },
        ]
      }
      fairness_audit_log: {
        Row: {
          action: string
          application_id: string | null
          created_at: string
          details: Json
          id: string
          performed_by: string
        }
        Insert: {
          action: string
          application_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          performed_by?: string
        }
        Update: {
          action?: string
          application_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          performed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "fairness_audit_log_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "bursary_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fairness_audit_log_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "bursary_applications_commissioner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fairness_audit_log_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "bursary_applications_treasury"
            referencedColumns: ["id"]
          },
        ]
      }
      fairness_tracking: {
        Row: {
          application_id: string | null
          consistency_flags: Json | null
          created_at: string
          data_consistency_score: number | null
          eligibility_adjustments_log: Json | null
          fairness_priority_score: number
          fraud_risk_level: string
          historical_status: string
          id: string
          is_fairness_priority_candidate: boolean
          last_funded_cycle_id: string | null
          national_id: string
          previous_attempts_count: number
          previous_funded_count: number
          previous_household_size: number | null
          previous_income_bracket: string | null
          previous_poverty_score: number | null
          priority_boost_applied: boolean
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          consistency_flags?: Json | null
          created_at?: string
          data_consistency_score?: number | null
          eligibility_adjustments_log?: Json | null
          fairness_priority_score?: number
          fraud_risk_level?: string
          historical_status?: string
          id?: string
          is_fairness_priority_candidate?: boolean
          last_funded_cycle_id?: string | null
          national_id: string
          previous_attempts_count?: number
          previous_funded_count?: number
          previous_household_size?: number | null
          previous_income_bracket?: string | null
          previous_poverty_score?: number | null
          priority_boost_applied?: boolean
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          consistency_flags?: Json | null
          created_at?: string
          data_consistency_score?: number | null
          eligibility_adjustments_log?: Json | null
          fairness_priority_score?: number
          fraud_risk_level?: string
          historical_status?: string
          id?: string
          is_fairness_priority_candidate?: boolean
          last_funded_cycle_id?: string | null
          national_id?: string
          previous_attempts_count?: number
          previous_funded_count?: number
          previous_household_size?: number | null
          previous_income_bracket?: string | null
          previous_poverty_score?: number | null
          priority_boost_applied?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fairness_tracking_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "bursary_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fairness_tracking_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "bursary_applications_commissioner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fairness_tracking_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "bursary_applications_treasury"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fairness_tracking_last_funded_cycle_id_fkey"
            columns: ["last_funded_cycle_id"]
            isOneToOne: false
            referencedRelation: "allocation_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_flags: {
        Row: {
          created_at: string
          evidence: Json
          flag_code: string
          id: string
          parent_application_id: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          student_beneficiary_id: string | null
        }
        Insert: {
          created_at?: string
          evidence?: Json
          flag_code: string
          id?: string
          parent_application_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          student_beneficiary_id?: string | null
        }
        Update: {
          created_at?: string
          evidence?: Json
          flag_code?: string
          id?: string
          parent_application_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          student_beneficiary_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fraud_flags_parent_application_id_fkey"
            columns: ["parent_application_id"]
            isOneToOne: false
            referencedRelation: "parent_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_student_beneficiary_id_fkey"
            columns: ["student_beneficiary_id"]
            isOneToOne: false
            referencedRelation: "student_beneficiaries"
            referencedColumns: ["id"]
          },
        ]
      }
      household_child_codes: {
        Row: {
          child_code: string
          child_index: number
          created_at: string
          household_tracking_id: string
          id: string
          parent_application_id: string
          student_beneficiary_id: string
        }
        Insert: {
          child_code: string
          child_index: number
          created_at?: string
          household_tracking_id: string
          id?: string
          parent_application_id: string
          student_beneficiary_id: string
        }
        Update: {
          child_code?: string
          child_index?: number
          created_at?: string
          household_tracking_id?: string
          id?: string
          parent_application_id?: string
          student_beneficiary_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_child_codes_parent_application_id_fkey"
            columns: ["parent_application_id"]
            isOneToOne: false
            referencedRelation: "parent_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_child_codes_student_beneficiary_id_fkey"
            columns: ["student_beneficiary_id"]
            isOneToOne: true
            referencedRelation: "student_beneficiaries"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          created_at: string
          household_id: string
          id: string
          parent_application_id: string | null
          student_beneficiary_id: string | null
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          parent_application_id?: string | null
          student_beneficiary_id?: string | null
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          parent_application_id?: string | null
          student_beneficiary_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_parent_application_id_fkey"
            columns: ["parent_application_id"]
            isOneToOne: false
            referencedRelation: "parent_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_student_beneficiary_id_fkey"
            columns: ["student_beneficiary_id"]
            isOneToOne: false
            referencedRelation: "student_beneficiaries"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          household_tracking_id: string | null
          id: string
          parent_county: string | null
          parent_email: string | null
          parent_full_name: string | null
          parent_national_id: string
          parent_phone: string | null
          parent_ward: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          household_tracking_id?: string | null
          id?: string
          parent_county?: string | null
          parent_email?: string | null
          parent_full_name?: string | null
          parent_national_id: string
          parent_phone?: string | null
          parent_ward?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          household_tracking_id?: string | null
          id?: string
          parent_county?: string | null
          parent_email?: string | null
          parent_full_name?: string | null
          parent_national_id?: string
          parent_phone?: string | null
          parent_ward?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      kenya_locations: {
        Row: {
          county: string
          ward: string
        }
        Insert: {
          county: string
          ward: string
        }
        Update: {
          county?: string
          ward?: string
        }
        Relationships: []
      }
      notification_history: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          event_type: string
          household_id: string | null
          id: string
          parent_national_id: string | null
          read_at: string | null
          title: string
        }
        Insert: {
          body?: string | null
          channel?: string
          created_at?: string
          event_type: string
          household_id?: string | null
          id?: string
          parent_national_id?: string | null
          read_at?: string | null
          title: string
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          event_type?: string
          household_id?: string | null
          id?: string
          parent_national_id?: string | null
          read_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_history_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_applications: {
        Row: {
          advert_id: string
          ai_decision_reason: string | null
          created_at: string
          current_stage: string
          document_urls: Json
          household_dependents: number
          household_disability_burden: boolean
          household_income: number
          household_tracking_id: string | null
          id: string
          locked_for_resubmission: boolean
          parent_county: string
          parent_email: string | null
          parent_full_name: string
          parent_national_id: string
          parent_phone: string
          parent_ward: string | null
          poverty_answers: Json
          poverty_score: number
          poverty_tier: string | null
          released_to_treasury: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          sms_consent: boolean
          status: string
          total_students: number
          tracking_number: string
          updated_at: string
          workflow_stage: string
        }
        Insert: {
          advert_id: string
          ai_decision_reason?: string | null
          created_at?: string
          current_stage?: string
          document_urls?: Json
          household_dependents?: number
          household_disability_burden?: boolean
          household_income?: number
          household_tracking_id?: string | null
          id?: string
          locked_for_resubmission?: boolean
          parent_county: string
          parent_email?: string | null
          parent_full_name: string
          parent_national_id: string
          parent_phone: string
          parent_ward?: string | null
          poverty_answers?: Json
          poverty_score?: number
          poverty_tier?: string | null
          released_to_treasury?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          sms_consent?: boolean
          status?: string
          total_students?: number
          tracking_number: string
          updated_at?: string
          workflow_stage?: string
        }
        Update: {
          advert_id?: string
          ai_decision_reason?: string | null
          created_at?: string
          current_stage?: string
          document_urls?: Json
          household_dependents?: number
          household_disability_burden?: boolean
          household_income?: number
          household_tracking_id?: string | null
          id?: string
          locked_for_resubmission?: boolean
          parent_county?: string
          parent_email?: string | null
          parent_full_name?: string
          parent_national_id?: string
          parent_phone?: string
          parent_ward?: string | null
          poverty_answers?: Json
          poverty_score?: number
          poverty_tier?: string | null
          released_to_treasury?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          sms_consent?: boolean
          status?: string
          total_students?: number
          tracking_number?: string
          updated_at?: string
          workflow_stage?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          created_at: string
          disbursement_id: string
          id: string
          provider: string
          provider_reference: string | null
          request_payload: Json
          response_payload: Json
          status: string
        }
        Insert: {
          created_at?: string
          disbursement_id: string
          id?: string
          provider: string
          provider_reference?: string | null
          request_payload?: Json
          response_payload?: Json
          status: string
        }
        Update: {
          created_at?: string
          disbursement_id?: string
          id?: string
          provider?: string
          provider_reference?: string | null
          request_payload?: Json
          response_payload?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_disbursement_id_fkey"
            columns: ["disbursement_id"]
            isOneToOne: false
            referencedRelation: "disbursements"
            referencedColumns: ["id"]
          },
        ]
      }
      poverty_question_bank: {
        Row: {
          applies_to: string
          category: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          options: Json
          text_en: string
          text_sw: string
          weight_high_school: number
          weight_higher_ed: number
        }
        Insert: {
          applies_to: string
          category: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          options?: Json
          text_en: string
          text_sw: string
          weight_high_school?: number
          weight_higher_ed?: number
        }
        Update: {
          applies_to?: string
          category?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          options?: Json
          text_en?: string
          text_sw?: string
          weight_high_school?: number
          weight_higher_ed?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          assigned_county: string | null
          assigned_ward: string | null
          created_at: string
          display_name: string | null
          email: string
          id: string
          password_changed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_county?: string | null
          assigned_ward?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          password_changed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_county?: string | null
          assigned_ward?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          password_changed_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      provisioning_invites: {
        Row: {
          accepted_at: string | null
          assigned_county: string | null
          assigned_ward: string | null
          email: string
          id: string
          invited_at: string
          invited_by: string | null
          notes: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
        }
        Insert: {
          accepted_at?: string | null
          assigned_county?: string | null
          assigned_ward?: string | null
          email: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          notes?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Update: {
          accepted_at?: string | null
          assigned_county?: string | null
          assigned_ward?: string | null
          email?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          notes?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string
          details: Json
          event_type: string
          id: string
          ip_address: string | null
          severity: string
          source: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          ip_address?: string | null
          severity?: string
          source?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          ip_address?: string | null
          severity?: string
          source?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      seo_audit_results: {
        Row: {
          accessibility_score: number | null
          best_practices_score: number | null
          created_at: string
          id: string
          is_regression: boolean
          notes: string | null
          performance_score: number | null
          regression_reasons: Json
          rich_results_errors: Json
          seo_score: number | null
          source: string
          url: string
        }
        Insert: {
          accessibility_score?: number | null
          best_practices_score?: number | null
          created_at?: string
          id?: string
          is_regression?: boolean
          notes?: string | null
          performance_score?: number | null
          regression_reasons?: Json
          rich_results_errors?: Json
          seo_score?: number | null
          source?: string
          url: string
        }
        Update: {
          accessibility_score?: number | null
          best_practices_score?: number | null
          created_at?: string
          id?: string
          is_regression?: boolean
          notes?: string | null
          performance_score?: number | null
          regression_reasons?: Json
          rich_results_errors?: Json
          seo_score?: number | null
          source?: string
          url?: string
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          applicant_name_masked: string | null
          application_id: string | null
          created_at: string
          error: string | null
          event_type: string
          id: string
          message: string
          metadata: Json
          phone_masked: string | null
          provider: string | null
          provider_ref: string | null
          recipient: string
          sent_at: string | null
          stage: string | null
          status: string
          tracking_id: string | null
        }
        Insert: {
          applicant_name_masked?: string | null
          application_id?: string | null
          created_at?: string
          error?: string | null
          event_type: string
          id?: string
          message: string
          metadata?: Json
          phone_masked?: string | null
          provider?: string | null
          provider_ref?: string | null
          recipient: string
          sent_at?: string | null
          stage?: string | null
          status?: string
          tracking_id?: string | null
        }
        Update: {
          applicant_name_masked?: string | null
          application_id?: string | null
          created_at?: string
          error?: string | null
          event_type?: string
          id?: string
          message?: string
          metadata?: Json
          phone_masked?: string | null
          provider?: string | null
          provider_ref?: string | null
          recipient?: string
          sent_at?: string | null
          stage?: string | null
          status?: string
          tracking_id?: string | null
        }
        Relationships: []
      }
      student_beneficiaries: {
        Row: {
          admission_number: string | null
          ai_decision_reason: string | null
          allocated_amount: number | null
          allocation_date: string | null
          assessment_pipeline:
            | Database["public"]["Enums"]["assessment_pipeline"]
            | null
          class_form: string | null
          created_at: string
          decision_reason_code: string | null
          disability_card_url: string | null
          disability_status: string | null
          disability_type: string | null
          disability_verified: boolean
          dvl_notes: string | null
          dvl_verified_at: string | null
          dvl_verified_by: string | null
          education_category:
            | Database["public"]["Enums"]["education_category"]
            | null
          fee_balance: number | null
          fraud_flags: Json
          fraud_score: number
          health_status: string | null
          id: string
          institution_name: string
          ncpwd_registration_number: string | null
          parent_application_id: string
          poverty_index_score: number | null
          rank_in_pipeline: number | null
          released_to_treasury: boolean
          status: string
          student_full_name: string
          student_identifier: string
          student_type: string
          updated_at: string
          year_of_study: string | null
        }
        Insert: {
          admission_number?: string | null
          ai_decision_reason?: string | null
          allocated_amount?: number | null
          allocation_date?: string | null
          assessment_pipeline?:
            | Database["public"]["Enums"]["assessment_pipeline"]
            | null
          class_form?: string | null
          created_at?: string
          decision_reason_code?: string | null
          disability_card_url?: string | null
          disability_status?: string | null
          disability_type?: string | null
          disability_verified?: boolean
          dvl_notes?: string | null
          dvl_verified_at?: string | null
          dvl_verified_by?: string | null
          education_category?:
            | Database["public"]["Enums"]["education_category"]
            | null
          fee_balance?: number | null
          fraud_flags?: Json
          fraud_score?: number
          health_status?: string | null
          id?: string
          institution_name: string
          ncpwd_registration_number?: string | null
          parent_application_id: string
          poverty_index_score?: number | null
          rank_in_pipeline?: number | null
          released_to_treasury?: boolean
          status?: string
          student_full_name: string
          student_identifier: string
          student_type?: string
          updated_at?: string
          year_of_study?: string | null
        }
        Update: {
          admission_number?: string | null
          ai_decision_reason?: string | null
          allocated_amount?: number | null
          allocation_date?: string | null
          assessment_pipeline?:
            | Database["public"]["Enums"]["assessment_pipeline"]
            | null
          class_form?: string | null
          created_at?: string
          decision_reason_code?: string | null
          disability_card_url?: string | null
          disability_status?: string | null
          disability_type?: string | null
          disability_verified?: boolean
          dvl_notes?: string | null
          dvl_verified_at?: string | null
          dvl_verified_by?: string | null
          education_category?:
            | Database["public"]["Enums"]["education_category"]
            | null
          fee_balance?: number | null
          fraud_flags?: Json
          fraud_score?: number
          health_status?: string | null
          id?: string
          institution_name?: string
          ncpwd_registration_number?: string | null
          parent_application_id?: string
          poverty_index_score?: number | null
          rank_in_pipeline?: number | null
          released_to_treasury?: boolean
          status?: string
          student_full_name?: string
          student_identifier?: string
          student_type?: string
          updated_at?: string
          year_of_study?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_beneficiaries_parent_application_id_fkey"
            columns: ["parent_application_id"]
            isOneToOne: false
            referencedRelation: "parent_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      sync_metrics: {
        Row: {
          details: Json
          id: string
          metric: string
          recorded_at: string
          severity: string
          source: string
          value: number
        }
        Insert: {
          details?: Json
          id?: string
          metric: string
          recorded_at?: string
          severity?: string
          source: string
          value: number
        }
        Update: {
          details?: Json
          id?: string
          metric?: string
          recorded_at?: string
          severity?: string
          source?: string
          value?: number
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
      bursary_applications_commissioner: {
        Row: {
          advert_id: string | null
          ai_decision_reason: string | null
          allocated_amount: number | null
          allocation_date: string | null
          class_form: string | null
          created_at: string | null
          household_dependents: number | null
          household_income: number | null
          id: string | null
          institution_name: string | null
          is_duplicate: boolean | null
          parent_county: string | null
          parent_name_masked: string | null
          parent_ward: string | null
          poverty_score: number | null
          poverty_tier: string | null
          released_to_treasury: boolean | null
          reviewed_at: string | null
          status: string | null
          student_name_masked: string | null
          student_type: string | null
          tracking_number: string | null
          updated_at: string | null
          year_of_study: string | null
        }
        Insert: {
          advert_id?: string | null
          ai_decision_reason?: string | null
          allocated_amount?: number | null
          allocation_date?: string | null
          class_form?: string | null
          created_at?: string | null
          household_dependents?: number | null
          household_income?: number | null
          id?: string | null
          institution_name?: string | null
          is_duplicate?: boolean | null
          parent_county?: string | null
          parent_name_masked?: never
          parent_ward?: string | null
          poverty_score?: number | null
          poverty_tier?: never
          released_to_treasury?: boolean | null
          reviewed_at?: string | null
          status?: never
          student_name_masked?: never
          student_type?: never
          tracking_number?: string | null
          updated_at?: string | null
          year_of_study?: string | null
        }
        Update: {
          advert_id?: string | null
          ai_decision_reason?: string | null
          allocated_amount?: number | null
          allocation_date?: string | null
          class_form?: string | null
          created_at?: string | null
          household_dependents?: number | null
          household_income?: number | null
          id?: string | null
          institution_name?: string | null
          is_duplicate?: boolean | null
          parent_county?: string | null
          parent_name_masked?: never
          parent_ward?: string | null
          poverty_score?: number | null
          poverty_tier?: never
          released_to_treasury?: boolean | null
          reviewed_at?: string | null
          status?: never
          student_name_masked?: never
          student_type?: never
          tracking_number?: string | null
          updated_at?: string | null
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
        ]
      }
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
          county?: string | null
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
          county?: string | null
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
      compute_fraud_score: { Args: { _student_id: string }; Returns: number }
      compute_poverty_score: {
        Args: { _answers: Json }
        Returns: {
          score: number
          tier: string
        }[]
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      detect_duplicate_applicant: {
        Args: {
          _identifier: string
          _institution?: string
          _parent_national_id: string
          _year?: string
        }
        Returns: {
          match_type: string
          matched_household_id: string
          matched_student_id: string
        }[]
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      generate_household_tracking_id: { Args: never; Returns: string }
      generate_tracking_number: { Args: never; Returns: string }
      get_commissioner_applications: {
        Args: never
        Returns: {
          advert_id: string
          ai_decision_reason: string
          allocated_amount: number
          allocation_date: string
          class_form: string
          created_at: string
          household_dependents: number
          household_income: number
          id: string
          institution_name: string
          is_duplicate: boolean
          parent_county: string
          parent_name_masked: string
          parent_ward: string
          poverty_score: number
          poverty_tier: string
          released_to_treasury: boolean
          reviewed_at: string
          status: string
          student_name_masked: string
          student_type: string
          tracking_number: string
          updated_at: string
          year_of_study: string
        }[]
      }
      get_household_by_id: {
        Args: { _household_id: string; _verifier: string }
        Returns: Json
      }
      get_household_summary: {
        Args: { _lookup: string; _verifier?: string }
        Returns: Json
      }
      get_internal_config: { Args: { _key: string }; Returns: string }
      get_or_create_household: {
        Args: { _national_id: string; _parent?: Json }
        Returns: {
          created_at: string
          household_tracking_id: string | null
          id: string
          parent_county: string | null
          parent_email: string | null
          parent_full_name: string | null
          parent_national_id: string
          parent_phone: string | null
          parent_ward: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "households"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_parent_application_by_tracking: {
        Args: { _tracking: string; _verifier: string }
        Returns: Json
      }
      get_parent_applications_for_commissioner: {
        Args: never
        Returns: {
          advert_id: string
          ai_decision_reason: string
          created_at: string
          current_stage: string
          household_dependents: number
          household_income: number
          id: string
          parent_county: string
          parent_name_masked: string
          parent_ward: string
          poverty_score: number
          poverty_tier: string
          released_to_treasury: boolean
          status: string
          students: Json
          total_students: number
          tracking_number: string
          updated_at: string
        }[]
      }
      get_treasury_applications: {
        Args: never
        Returns: {
          advert_budget: number
          advert_closed_at: string
          advert_deadline: string
          advert_id: string
          advert_is_active: boolean
          advert_title: string
          advert_ward: string
          allocated_amount: number
          allocation_date: string
          county: string
          created_at: string
          ecitizen_ref: string
          id: string
          institution_name: string
          poverty_score: number
          poverty_tier: string
          status: string
          student_name_masked: string
          student_type: string
          tracking_number: string
          updated_at: string
        }[]
      }
      get_treasury_student_beneficiaries: {
        Args: never
        Returns: {
          allocated_amount: number
          allocation_date: string
          county: string
          created_at: string
          id: string
          institution_name: string
          parent_application_id: string
          status: string
          student_name_masked: string
          student_type: string
          tracking_number: string
          updated_at: string
        }[]
      }
      get_user_assigned_county: { Args: { p_user_id: string }; Returns: string }
      get_user_assigned_ward: { Args: { p_user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_audit: {
        Args: {
          _details?: Json
          _entity_id: string
          _entity_type: string
          _event_type: string
        }
        Returns: string
      }
      log_security_event: {
        Args: {
          _details?: Json
          _event_type: string
          _ip?: string
          _severity?: string
          _source?: string
          _user_agent?: string
        }
        Returns: string
      }
      mark_dvl_verified: {
        Args: { _notes?: string; _student_id: string; _verified: boolean }
        Returns: Json
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      submit_parent_application: {
        Args: {
          _advert_id: string
          _parent: Json
          _students: Json
          _tracking?: string
        }
        Returns: {
          parent_id: string
          tracking_number: string
        }[]
      }
      sweep_expired_adverts: { Args: never; Returns: number }
      tracking_number_exists: { Args: { _tn: string }; Returns: boolean }
      treasury_disburse_applications: {
        Args: { _ids: string[] }
        Returns: Json
      }
      workflow_backlog_snapshot: {
        Args: never
        Returns: {
          metric: string
          value: number
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "user"
        | "county_treasury"
        | "county_commissioner"
        | "governance_approver"
      application_status:
        | "received"
        | "review"
        | "verification"
        | "approved"
        | "rejected"
        | "disbursed"
      assessment_pipeline: "basic_education" | "higher_education"
      education_category: "high_school" | "university" | "college" | "tvet"
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
      app_role: [
        "admin",
        "user",
        "county_treasury",
        "county_commissioner",
        "governance_approver",
      ],
      application_status: [
        "received",
        "review",
        "verification",
        "approved",
        "rejected",
        "disbursed",
      ],
      assessment_pipeline: ["basic_education", "higher_education"],
      education_category: ["high_school", "university", "college", "tvet"],
      poverty_tier: ["Low", "Medium", "High"],
      student_type: ["secondary", "university"],
    },
  },
} as const
