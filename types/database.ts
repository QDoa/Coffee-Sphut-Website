export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      AdminAuditLog: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_role: string | null
          changed_fields: string[] | null
          created_at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          reason: string | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          changed_fields?: string[] | null
          created_at?: string
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          reason?: string | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          changed_fields?: string[] | null
          created_at?: string
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          reason?: string | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      AdminUser: {
        Row: {
          created_at: string
          created_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      Author: {
        Row: {
          bio: Json | null
          created_at: string
          id: string
          image_url: string | null
          name: string
          sanity_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          bio?: Json | null
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          sanity_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          bio?: Json | null
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          sanity_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      Bookmark: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      Cafe: {
        Row: {
          address: string | null
          amenities: string[] | null
          chain_id: string
          created_at: string
          description: string | null
          email: string | null
          fts_vectors: unknown
          id: number
          image_url: string | null
          is_active: boolean | null
          latitude: number | null
          link: string | null
          location: unknown
          longitude: number | null
          loyalty_threshold_override: number | null
          name: string
          partner_revision: number
          phone_number: string | null
          postcode: string | null
          rating: number | null
          reward_code: string | null
          show_details: boolean | null
          social_media: Json | null
          time_open: Json | null
        }
        Insert: {
          address?: string | null
          amenities?: string[] | null
          chain_id: string
          created_at?: string
          description?: string | null
          email?: string | null
          fts_vectors?: unknown
          id?: number
          image_url?: string | null
          is_active?: boolean | null
          latitude?: number | null
          link?: string | null
          location?: unknown
          longitude?: number | null
          loyalty_threshold_override?: number | null
          name: string
          partner_revision?: number
          phone_number?: string | null
          postcode?: string | null
          rating?: number | null
          reward_code?: string | null
          show_details?: boolean | null
          social_media?: Json | null
          time_open?: Json | null
        }
        Update: {
          address?: string | null
          amenities?: string[] | null
          chain_id?: string
          created_at?: string
          description?: string | null
          email?: string | null
          fts_vectors?: unknown
          id?: number
          image_url?: string | null
          is_active?: boolean | null
          latitude?: number | null
          link?: string | null
          location?: unknown
          longitude?: number | null
          loyalty_threshold_override?: number | null
          name?: string
          partner_revision?: number
          phone_number?: string | null
          postcode?: string | null
          rating?: number | null
          reward_code?: string | null
          show_details?: boolean | null
          social_media?: Json | null
          time_open?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "Cafe_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "Chains"
            referencedColumns: ["id"]
          },
        ]
      }
      CafeImages: {
        Row: {
          cafe_id: number
          created_at: string
          images_url: string[] | null
        }
        Insert: {
          cafe_id: number
          created_at?: string
          images_url?: string[] | null
        }
        Update: {
          cafe_id?: number
          created_at?: string
          images_url?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "CafeImages_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: true
            referencedRelation: "Cafe"
            referencedColumns: ["id"]
          },
        ]
      }
      CafeMenu: {
        Row: {
          cafe_id: number
          created_at: string
          currency: string
          description: string | null
          id: string
          name: string
          price: number
        }
        Insert: {
          cafe_id: number
          created_at?: string
          currency: string
          description?: string | null
          id?: string
          name: string
          price: number
        }
        Update: {
          cafe_id?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "CafeMenu_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "Cafe"
            referencedColumns: ["id"]
          },
        ]
      }
      Category: {
        Row: {
          created_at: string
          description: string | null
          id: string
          sanity_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          sanity_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          sanity_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      Chains: {
        Row: {
          created_at: string
          id: string
          loyalty_threshold: number
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          loyalty_threshold?: number
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          loyalty_threshold?: number
          name?: string
        }
        Relationships: []
      }
      Event: {
        Row: {
          address: string | null
          cafe_id: number | null
          created_at: string
          description: string | null
          end_time: string | null
          id: string
          image_url: string | null
          is_featured: boolean
          link: string | null
          published_at: string | null
          slug: string
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          cafe_id?: number | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          link?: string | null
          published_at?: string | null
          slug: string
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          cafe_id?: number | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          link?: string | null
          published_at?: string | null
          slug?: string
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "Event_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "Cafe"
            referencedColumns: ["id"]
          },
        ]
      }
      OnboardingQuestion: {
        Row: {
          active: boolean
          created_at: string
          id: string
          multi_select: boolean
          options: string[]
          priority: number
          question: string
          sanity_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          multi_select?: boolean
          options?: string[]
          priority?: number
          question: string
          sanity_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          multi_select?: boolean
          options?: string[]
          priority?: number
          question?: string
          sanity_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      partner_accounts: {
        Row: {
          chain_id: string
          created_at: string
          plan: string
          reward_coverage_at: string
          selection_required: boolean
          timezone: string
        }
        Insert: {
          chain_id: string
          created_at?: string
          plan?: string
          reward_coverage_at?: string
          selection_required?: boolean
          timezone?: string
        }
        Update: {
          chain_id?: string
          created_at?: string
          plan?: string
          reward_coverage_at?: string
          selection_required?: boolean
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_accounts_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: true
            referencedRelation: "Chains"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_assignments: {
        Row: {
          cafe_id: number
          chain_id: string
          membership_id: string
        }
        Insert: {
          cafe_id: number
          chain_id: string
          membership_id: string
        }
        Update: {
          cafe_id?: number
          chain_id?: string
          membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_assignments_cafe_id_chain_id_fkey"
            columns: ["cafe_id", "chain_id"]
            isOneToOne: false
            referencedRelation: "Cafe"
            referencedColumns: ["id", "chain_id"]
          },
          {
            foreignKeyName: "partner_assignments_membership_id_chain_id_fkey"
            columns: ["membership_id", "chain_id"]
            isOneToOne: false
            referencedRelation: "partner_memberships"
            referencedColumns: ["id", "chain_id"]
          },
        ]
      }
      partner_audit: {
        Row: {
          action: string
          actor: string | null
          chain_id: string
          created_at: string
          details: Json
          id: number
          target: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          chain_id: string
          created_at?: string
          details?: Json
          id?: never
          target?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          chain_id?: string
          created_at?: string
          details?: Json
          id?: never
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_audit_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["chain_id"]
          },
        ]
      }
      partner_cafe_access: {
        Row: {
          cafe_id: number
          chain_id: string
          restricted: boolean
        }
        Insert: {
          cafe_id: number
          chain_id: string
          restricted?: boolean
        }
        Update: {
          cafe_id?: number
          chain_id?: string
          restricted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "partner_cafe_access_cafe_id_chain_id_fkey"
            columns: ["cafe_id", "chain_id"]
            isOneToOne: false
            referencedRelation: "Cafe"
            referencedColumns: ["id", "chain_id"]
          },
          {
            foreignKeyName: "partner_cafe_access_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["chain_id"]
          },
        ]
      }
      partner_changes: {
        Row: {
          baseline: number | null
          cafe_id: number | null
          chain_id: string
          created_at: string
          id: string
          media: Json
          payload: Json
          reason: string | null
          reviewed_at: string | null
          reviewer: string | null
          status: string
          submitter: string
        }
        Insert: {
          baseline?: number | null
          cafe_id?: number | null
          chain_id: string
          created_at?: string
          id?: string
          media?: Json
          payload: Json
          reason?: string | null
          reviewed_at?: string | null
          reviewer?: string | null
          status?: string
          submitter: string
        }
        Update: {
          baseline?: number | null
          cafe_id?: number | null
          chain_id?: string
          created_at?: string
          id?: string
          media?: Json
          payload?: Json
          reason?: string | null
          reviewed_at?: string | null
          reviewer?: string | null
          status?: string
          submitter?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_changes_cafe_id_chain_id_fkey"
            columns: ["cafe_id", "chain_id"]
            isOneToOne: false
            referencedRelation: "Cafe"
            referencedColumns: ["id", "chain_id"]
          },
          {
            foreignKeyName: "partner_changes_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["chain_id"]
          },
        ]
      }
      partner_invitations: {
        Row: {
          accepted_at: string | null
          cafe_ids: number[]
          chain_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          revoked_at: string | null
          role: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          cafe_ids?: number[]
          chain_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          role: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          cafe_ids?: number[]
          chain_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          role?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_invitations_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["chain_id"]
          },
        ]
      }
      partner_items: {
        Row: {
          active: boolean
          balance: number
          cafe_id: number
          chain_id: string
          code: string
          id: string
          name: string
          threshold: number
          type: string
          unit: string
        }
        Insert: {
          active?: boolean
          balance?: number
          cafe_id: number
          chain_id: string
          code: string
          id?: string
          name: string
          threshold?: number
          type: string
          unit: string
        }
        Update: {
          active?: boolean
          balance?: number
          cafe_id?: number
          chain_id?: string
          code?: string
          id?: string
          name?: string
          threshold?: number
          type?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_items_cafe_id_chain_id_fkey"
            columns: ["cafe_id", "chain_id"]
            isOneToOne: false
            referencedRelation: "Cafe"
            referencedColumns: ["id", "chain_id"]
          },
          {
            foreignKeyName: "partner_items_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["chain_id"]
          },
        ]
      }
      partner_media: {
        Row: {
          cafe_id: number | null
          chain_id: string
          cleanup_error: string | null
          created_at: string
          id: string
          mime: string
          path: string
          public_path: string
          size: number
          state: string
          uploader: string
        }
        Insert: {
          cafe_id?: number | null
          chain_id: string
          cleanup_error?: string | null
          created_at?: string
          id?: string
          mime: string
          path: string
          public_path: string
          size: number
          state?: string
          uploader: string
        }
        Update: {
          cafe_id?: number | null
          chain_id?: string
          cleanup_error?: string | null
          created_at?: string
          id?: string
          mime?: string
          path?: string
          public_path?: string
          size?: number
          state?: string
          uploader?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_media_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "Cafe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_media_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["chain_id"]
          },
        ]
      }
      partner_media_publications: {
        Row: {
          change_id: string
          completed_at: string | null
          prepared_at: string
          prepared_media: Json
          prepared_payload: Json
          reviewer: string
        }
        Insert: {
          change_id: string
          completed_at?: string | null
          prepared_at?: string
          prepared_media: Json
          prepared_payload: Json
          reviewer: string
        }
        Update: {
          change_id?: string
          completed_at?: string | null
          prepared_at?: string
          prepared_media?: Json
          prepared_payload?: Json
          reviewer?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_media_publications_change_id_fkey"
            columns: ["change_id"]
            isOneToOne: true
            referencedRelation: "partner_changes"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_memberships: {
        Row: {
          chain_id: string
          created_at: string
          id: string
          revoked_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          chain_id: string
          created_at?: string
          id?: string
          revoked_at?: string | null
          role: string
          user_id: string
        }
        Update: {
          chain_id?: string
          created_at?: string
          id?: string
          revoked_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_memberships_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["chain_id"]
          },
        ]
      }
      partner_movements: {
        Row: {
          actor: string
          cafe_id: number
          chain_id: string
          created_at: string
          id: string
          item_id: string
          quantity: number
          reason: string
          resulting_balance: number
          type: string
        }
        Insert: {
          actor: string
          cafe_id: number
          chain_id: string
          created_at?: string
          id?: string
          item_id: string
          quantity: number
          reason: string
          resulting_balance: number
          type: string
        }
        Update: {
          actor?: string
          cafe_id?: number
          chain_id?: string
          created_at?: string
          id?: string
          item_id?: string
          quantity?: number
          reason?: string
          resulting_balance?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_movements_cafe_id_chain_id_fkey"
            columns: ["cafe_id", "chain_id"]
            isOneToOne: false
            referencedRelation: "Cafe"
            referencedColumns: ["id", "chain_id"]
          },
          {
            foreignKeyName: "partner_movements_item_id_chain_id_fkey"
            columns: ["item_id", "chain_id"]
            isOneToOne: false
            referencedRelation: "partner_items"
            referencedColumns: ["id", "chain_id"]
          },
        ]
      }
      partner_operations: {
        Row: {
          action: string
          actor: string
          created_at: string
          input: Json
          request_id: string
          result: Json
        }
        Insert: {
          action: string
          actor: string
          created_at?: string
          input: Json
          request_id: string
          result: Json
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          input?: Json
          request_id?: string
          result?: Json
        }
        Relationships: []
      }
      partner_recipes: {
        Row: {
          active: boolean
          chain_id: string
          id: string
          ingredients: Json
          name: string
          revision: number
          updated_at: string
          yield: number
        }
        Insert: {
          active?: boolean
          chain_id: string
          id?: string
          ingredients: Json
          name: string
          revision?: number
          updated_at?: string
          yield: number
        }
        Update: {
          active?: boolean
          chain_id?: string
          id?: string
          ingredients?: Json
          name?: string
          revision?: number
          updated_at?: string
          yield?: number
        }
        Relationships: [
          {
            foreignKeyName: "partner_recipes_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["chain_id"]
          },
        ]
      }
      Post: {
        Row: {
          author_id: string | null
          body: string | null
          created_at: string
          id: string
          main_image_url: string | null
          published_at: string | null
          sanity_id: string | null
          slug: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          main_image_url?: string | null
          published_at?: string | null
          sanity_id?: string | null
          slug: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          main_image_url?: string | null
          published_at?: string | null
          sanity_id?: string | null
          slug?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "Post_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "Author"
            referencedColumns: ["id"]
          },
        ]
      }
      PostCategory: {
        Row: {
          category_id: string
          created_at: string
          post_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          post_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "PostCategory_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "Category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "PostCategory_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "Post"
            referencedColumns: ["id"]
          },
        ]
      }
      Profile: {
        Row: {
          created_at: string
          id: string
          onboarding_completed: boolean
          onboarding_responses: Json | null
        }
        Insert: {
          created_at?: string
          id: string
          onboarding_completed?: boolean
          onboarding_responses?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          onboarding_completed?: boolean
          onboarding_responses?: Json | null
        }
        Relationships: []
      }
      Recipe: {
        Row: {
          cook_time_minutes: number | null
          created_at: string
          description: string | null
          difficulty: string | null
          id: string
          image_url: string | null
          ingredients: Json
          instructions: Json
          prep_time_minutes: number | null
          published_at: string | null
          servings: number | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          cook_time_minutes?: number | null
          created_at?: string
          description?: string | null
          difficulty?: string | null
          id?: string
          image_url?: string | null
          ingredients?: Json
          instructions?: Json
          prep_time_minutes?: number | null
          published_at?: string | null
          servings?: number | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          cook_time_minutes?: number | null
          created_at?: string
          description?: string | null
          difficulty?: string | null
          id?: string
          image_url?: string | null
          ingredients?: Json
          instructions?: Json
          prep_time_minutes?: number | null
          published_at?: string | null
          servings?: number | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      Rewards: {
        Row: {
          chain_id: string
          earned_store: number
          id: string
          issued_at: string
          redeemed_at: string
          redeemed_cafe_id: number | null
          status: string
          user_id: string
          voided_at: string | null
        }
        Insert: {
          chain_id: string
          earned_store: number
          id?: string
          issued_at?: string
          redeemed_at?: string
          redeemed_cafe_id?: number | null
          status?: string
          user_id: string
          voided_at?: string | null
        }
        Update: {
          chain_id?: string
          earned_store?: number
          id?: string
          issued_at?: string
          redeemed_at?: string
          redeemed_cafe_id?: number | null
          status?: string
          user_id?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Rewards_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "Chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Rewards_earned_store_fkey"
            columns: ["earned_store"]
            isOneToOne: false
            referencedRelation: "Cafe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Rewards_redeemed_cafe_id_fkey"
            columns: ["redeemed_cafe_id"]
            isOneToOne: false
            referencedRelation: "Cafe"
            referencedColumns: ["id"]
          },
        ]
      }
      RewardTransaction: {
        Row: {
          created_at: string
          id: string
          store_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          store_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          store_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "RewardTransaction_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "Cafe"
            referencedColumns: ["id"]
          },
        ]
      }
      SavedCafe: {
        Row: {
          cafe_id: number
          created_at: string
          user_id: string
        }
        Insert: {
          cafe_id: number
          created_at?: string
          user_id?: string
        }
        Update: {
          cafe_id?: number
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "SavedCafe_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "Cafe"
            referencedColumns: ["id"]
          },
        ]
      }
      UserChainLoyalty: {
        Row: {
          chain_id: string
          created_at: string
          id: string
          last_reset_at: string
          punch_count: number | null
          reward_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          chain_id: string
          created_at?: string
          id?: string
          last_reset_at?: string
          punch_count?: number | null
          reward_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          chain_id?: string
          created_at?: string
          id?: string
          last_reset_at?: string
          punch_count?: number | null
          reward_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "UserChainLoyalty_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "Chains"
            referencedColumns: ["id"]
          },
        ]
      }
      Waitlist: {
        Row: {
          created_at: string
          email: string
          id: number
          resend_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: number
          resend_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: number
          resend_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_reward_stamp: {
        Args: { p_cafe_code: string; p_user_id: string }
        Returns: string
      }
      admin_adjust_punch_count: {
        Args: {
          p_chain_id: string
          p_new_count: number
          p_reason: string
          p_user_id: string
        }
        Returns: {
          chain_id: string
          created_at: string
          id: string
          last_reset_at: string
          punch_count: number | null
          reward_count: number | null
          updated_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "UserChainLoyalty"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_reset_onboarding: {
        Args: { p_reason: string; p_user_id: string }
        Returns: undefined
      }
      admin_void_reward: {
        Args: { p_reason: string; p_reward_id: string }
        Returns: {
          chain_id: string
          earned_store: number
          id: string
          issued_at: string
          redeemed_at: string
          redeemed_cafe_id: number | null
          status: string
          user_id: string
          voided_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "Rewards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_closest_cafes: {
        Args: {
          amenity_ids?: string[]
          has_reward?: boolean
          max_results?: number
          search_term?: string
          user_lat: number
          user_long: number
        }
        Returns: {
          address: string
          amenities: string[]
          description: string
          distance_meters: number
          email: string
          id: number
          image_url: string
          images_url: string[]
          latitude: number
          link: string
          longitude: number
          name: string
          phone_number: string
          rating: number
          reward_code: string
          show_details: boolean
          social_media: Json
          time_open: Json
        }[]
      }
      get_closest_cafes_v2: {
        Args: {
          amenity_ids?: string[]
          has_reward?: boolean
          max_results?: number
          search_term?: string
          user_lat: number
          user_long: number
        }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      log_staff_login: { Args: { p_method: string }; Returns: undefined }
      partner_can_cafe: { Args: { p_cafe: number }; Returns: boolean }
      partner_cafe_request: {
        Args: { p_id: string; p_chain: string }
        Returns: Json
      }
      partner_command: {
        Args: { p_action: string; p_input: Json }
        Returns: Json
      }
      partner_command_core: {
        Args: { p_action: string; p_input: Json }
        Returns: Json
      }
      partner_discard_cafe_change: {
        Args: { p_change: string; p_status: string }
        Returns: boolean
      }
      partner_edit_manager_access: {
        Args: {
          p_member: string
          p_expected_role: string
          p_expected_cafe_ids: number[]
          p_role: string
          p_cafe_ids: number[]
        }
        Returns: undefined
      }
      partner_insights: { Args: never; Returns: Json }
      partner_media_cleanup: {
        Args: { p_id: string; p_result?: string }
        Returns: {
          cafe_id: number | null
          chain_id: string
          cleanup_error: string | null
          created_at: string
          id: string
          mime: string
          path: string
          public_path: string
          size: number
          state: string
          uploader: string
        }
        SetofOptions: {
          from: "*"
          to: "partner_media"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      partner_media_prepare: {
        Args: { p_change: string }
        Returns: {
          cafe_id: number | null
          chain_id: string
          cleanup_error: string | null
          created_at: string
          id: string
          mime: string
          path: string
          public_path: string
          size: number
          state: string
          uploader: string
        }[]
        SetofOptions: {
          from: "*"
          to: "partner_media"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      partner_media_read: { Args: { asset: string }; Returns: boolean }
      partner_media_ready: { Args: { p_id: string }; Returns: undefined }
      partner_media_reserve: {
        Args: {
          p_cafe: number
          p_chain: string
          p_mime: string
          p_size: number
        }
        Returns: {
          cafe_id: number | null
          chain_id: string
          cleanup_error: string | null
          created_at: string
          id: string
          mime: string
          path: string
          public_path: string
          size: number
          state: string
          uploader: string
        }
        SetofOptions: {
          from: "*"
          to: "partner_media"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      partner_media_scope: {
        Args: { cafe: number; cid: string }
        Returns: boolean
      }
      partner_media_url: { Args: { p_url: string }; Returns: string }
      partner_paid: { Args: { p_chain: string }; Returns: boolean }
      partner_protected_image_paths: { Args: never; Returns: string[] }
      partner_plan_cafes: {
        Args: { p_chain: string }
        Returns: Json
      }
      partner_recipe_stock: {
        Args: { p_cafe_id: number; p_recipe_id: string }
        Returns: Json
      }
      partner_import_daily_sales: {
        Args: { p_chain: string; p_cafe: number; p_rows: Json; p_replace?: boolean }
        Returns: number
      }
      partner_sales_report: {
        Args: { p_chain: string; p_cafe?: number; p_from?: string; p_to?: string; p_currency?: string; p_channel?: string }
        Returns: Json
      }
      partner_import_recipe_sales: {
        Args: { p_chain: string; p_cafe: number; p_rows: Json; p_replace: boolean }
        Returns: number
      }
      partner_recipe_sales_report: {
        Args: { p_chain: string; p_from: string; p_to: string; p_cafe?: number; p_channel?: string }
        Returns: Json
      }
      partner_demo_pos_status: {
        Args: { p_chain: string }
        Returns: Json
      }
      partner_sync_demo_pos: {
        Args: { p_chain: string }
        Returns: number
      }
      partner_consume_recipe: {
        Args: { p_chain: string; p_cafe: number; p_recipe: string; p_revision: number; p_servings: number; p_request: string }
        Returns: number
      }
      partner_role: { Args: { p_chain: string }; Returns: string }
      partner_team_assignments: {
        Args: { p_chain: string }
        Returns: Json
      }
      partner_request_queue: {
        Args: { p_staff: boolean; p_search: string; p_filter: string; p_page: number }
        Returns: Json
      }
      partner_review_notifications: {
        Args: { p_page: number }
        Returns: Json
      }
      partner_mark_review_notification_read: {
        Args: { p_change: string }
        Returns: undefined
      }
      partner_snapshot: {
        Args: { p_input?: Json; p_section?: string }
        Returns: Json
      }
      partner_save_stocktake: {
        Args: { p_chain: string; p_cafe: number; p_request: string; p_counts: Json; p_reason: string }
        Returns: number
      }
      partner_stocktake_items: { Args: { p_chain: string }; Returns: Json }
      partner_validate_cafe: { Args: { p: Json }; Returns: undefined }
      public_cafes_v2: {
        Args: { p_ids?: number[]; p_search?: string }
        Returns: Json
      }
      redeem_reward: {
        Args: { p_cafe_code: string; p_reward_id: string }
        Returns: string
      }
      reward_available: { Args: { p_reward: string }; Returns: boolean }
      staff_role: { Args: never; Returns: string }
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
    Enums: {},
  },
} as const

