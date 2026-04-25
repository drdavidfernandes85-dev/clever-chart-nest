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
      badges: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          slug: string
          tier: string
          xp_reward: number
        }
        Insert: {
          created_at?: string
          description: string
          icon: string
          id?: string
          name: string
          slug: string
          tier?: string
          xp_reward?: number
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          slug?: string
          tier?: string
          xp_reward?: number
        }
        Relationships: []
      }
      booking_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          purpose: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          purpose?: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          purpose?: string
          status?: string
        }
        Relationships: []
      }
      channels: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          channel_id: string
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          reply_to_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          content: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          reply_to_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          reply_to_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "messages_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mt_account_snapshots: {
        Row: {
          account_id: string
          balance: number
          equity: number
          id: string
          margin: number | null
          recorded_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          balance: number
          equity: number
          id?: string
          margin?: number | null
          recorded_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          balance?: number
          equity?: number
          id?: string
          margin?: number | null
          recorded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mt_account_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_mt_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mt_account_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_mt_accounts_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      mt_pending_orders: {
        Row: {
          account_id: string | null
          created_at: string
          ea_message: string | null
          ea_ticket: string | null
          entry_price: number | null
          executed_at: string | null
          fetched_at: string | null
          id: string
          order_type: string
          side: string
          signal_id: string | null
          status: string
          stop_loss: number | null
          symbol: string
          take_profit: number | null
          updated_at: string
          user_id: string
          volume: number
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          ea_message?: string | null
          ea_ticket?: string | null
          entry_price?: number | null
          executed_at?: string | null
          fetched_at?: string | null
          id?: string
          order_type?: string
          side: string
          signal_id?: string | null
          status?: string
          stop_loss?: number | null
          symbol: string
          take_profit?: number | null
          updated_at?: string
          user_id: string
          volume: number
        }
        Update: {
          account_id?: string | null
          created_at?: string
          ea_message?: string | null
          ea_ticket?: string | null
          entry_price?: number | null
          executed_at?: string | null
          fetched_at?: string | null
          id?: string
          order_type?: string
          side?: string
          signal_id?: string | null
          status?: string
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          updated_at?: string
          user_id?: string
          volume?: number
        }
        Relationships: []
      }
      mt_positions: {
        Row: {
          account_id: string
          commission: number | null
          current_price: number | null
          id: string
          open_price: number
          opened_at: string
          profit: number | null
          side: string
          stop_loss: number | null
          swap: number | null
          symbol: string
          take_profit: number | null
          ticket: string
          updated_at: string
          user_id: string
          volume: number
        }
        Insert: {
          account_id: string
          commission?: number | null
          current_price?: number | null
          id?: string
          open_price: number
          opened_at?: string
          profit?: number | null
          side: string
          stop_loss?: number | null
          swap?: number | null
          symbol: string
          take_profit?: number | null
          ticket: string
          updated_at?: string
          user_id: string
          volume: number
        }
        Update: {
          account_id?: string
          commission?: number | null
          current_price?: number | null
          id?: string
          open_price?: number
          opened_at?: string
          profit?: number | null
          side?: string
          stop_loss?: number | null
          swap?: number | null
          symbol?: string
          take_profit?: number | null
          ticket?: string
          updated_at?: string
          user_id?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "mt_positions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_mt_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mt_positions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_mt_accounts_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      mt_webhook_tokens: {
        Row: {
          created_at: string
          id: string
          label: string | null
          last_used_at: string | null
          last_used_ip: string | null
          revoked_at: string | null
          token_hash: string
          token_prefix: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          last_used_at?: string | null
          last_used_ip?: string | null
          revoked_at?: string | null
          token_hash: string
          token_prefix: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          last_used_at?: string | null
          last_used_ip?: string | null
          revoked_at?: string | null
          token_hash?: string
          token_prefix?: string
          user_id?: string
        }
        Relationships: []
      }
      mute_list: {
        Row: {
          created_at: string
          created_by: string
          id: string
          muted_until: string | null
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          muted_until?: string | null
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          muted_until?: string | null
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read: boolean
          ref_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read?: boolean
          ref_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read?: boolean
          ref_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          leaderboard_opt_out: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id?: string
          leaderboard_opt_out?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          leaderboard_opt_out?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      trade_journal: {
        Row: {
          closed_at: string | null
          created_at: string
          direction: string
          entry_price: number
          exit_price: number | null
          id: string
          notes: string | null
          opened_at: string
          pair: string
          pnl: number | null
          position_size: number | null
          r_multiple: number | null
          screenshot_url: string | null
          setup_tag: string | null
          status: string
          stop_loss: number | null
          take_profit: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          direction: string
          entry_price: number
          exit_price?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          pair: string
          pnl?: number | null
          position_size?: number | null
          r_multiple?: number | null
          screenshot_url?: string | null
          setup_tag?: string | null
          status?: string
          stop_loss?: number | null
          take_profit?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          direction?: string
          entry_price?: number
          exit_price?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          pair?: string
          pnl?: number | null
          position_size?: number | null
          r_multiple?: number | null
          screenshot_url?: string | null
          setup_tag?: string | null
          status?: string
          stop_loss?: number | null
          take_profit?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trading_signals: {
        Row: {
          author_id: string
          created_at: string
          direction: string
          entry_price: number
          id: string
          notes: string | null
          pair: string
          status: string
          stop_loss: number | null
          take_profit: number | null
          updated_at: string
        }
        Insert: {
          author_id: string
          created_at?: string
          direction: string
          entry_price: number
          id?: string
          notes?: string | null
          pair: string
          status?: string
          stop_loss?: number | null
          take_profit?: number | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          direction?: string
          entry_price?: number
          id?: string
          notes?: string | null
          pair?: string
          status?: string
          stop_loss?: number | null
          take_profit?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dashboard_layouts: {
        Row: {
          created_at: string
          id: string
          layouts: Json
          preset: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          layouts?: Json
          preset?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          layouts?: Json
          preset?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_mt_accounts: {
        Row: {
          account_type: string
          balance: number | null
          broker_name: string
          created_at: string
          currency: string | null
          equity: number | null
          free_margin: number | null
          id: string
          investor_password_encrypted: string | null
          last_error: string | null
          last_synced_at: string | null
          leverage: number | null
          login: string
          margin: number | null
          margin_level: number | null
          metaapi_account_id: string | null
          metaapi_token_encrypted: string | null
          nickname: string | null
          platform: string
          region: string | null
          server_name: string
          status: string
          status_message: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: string
          balance?: number | null
          broker_name: string
          created_at?: string
          currency?: string | null
          equity?: number | null
          free_margin?: number | null
          id?: string
          investor_password_encrypted?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          leverage?: number | null
          login: string
          margin?: number | null
          margin_level?: number | null
          metaapi_account_id?: string | null
          metaapi_token_encrypted?: string | null
          nickname?: string | null
          platform: string
          region?: string | null
          server_name: string
          status?: string
          status_message?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string
          balance?: number | null
          broker_name?: string
          created_at?: string
          currency?: string | null
          equity?: number | null
          free_margin?: number | null
          id?: string
          investor_password_encrypted?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          leverage?: number | null
          login?: string
          margin?: number | null
          margin_level?: number | null
          metaapi_account_id?: string | null
          metaapi_token_encrypted?: string | null
          nickname?: string | null
          platform?: string
          region?: string | null
          server_name?: string
          status?: string
          status_message?: string | null
          updated_at?: string
          user_id?: string
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
      user_settings: {
        Row: {
          created_at: string
          digest_day: number
          email_digest_optin: boolean
          id: string
          onboarding_completed: boolean
          updated_at: string
          user_id: string
          webinar_email_reminders: boolean
          webinar_inapp_reminders: boolean
        }
        Insert: {
          created_at?: string
          digest_day?: number
          email_digest_optin?: boolean
          id?: string
          onboarding_completed?: boolean
          updated_at?: string
          user_id: string
          webinar_email_reminders?: boolean
          webinar_inapp_reminders?: boolean
        }
        Update: {
          created_at?: string
          digest_day?: number
          email_digest_optin?: boolean
          id?: string
          onboarding_completed?: boolean
          updated_at?: string
          user_id?: string
          webinar_email_reminders?: boolean
          webinar_inapp_reminders?: boolean
        }
        Relationships: []
      }
      user_xp: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_activity_date: string | null
          level: number
          longest_streak: number
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          level?: number
          longest_streak?: number
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          level?: number
          longest_streak?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          category: string
          created_at: string
          description: string | null
          duration: string | null
          id: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          youtube_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          duration?: string | null
          id?: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          youtube_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          duration?: string | null
          id?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          youtube_id?: string
        }
        Relationships: []
      }
      webinars: {
        Row: {
          category: string
          created_at: string
          description: string | null
          duration_minutes: number
          host_name: string
          id: string
          performance_impact: string | null
          recording_url: string | null
          reminder_15m_sent: boolean
          reminder_live_sent: boolean
          scheduled_at: string
          status: string
          stream_url: string | null
          thumbnail_url: string | null
          title: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          host_name: string
          id?: string
          performance_impact?: string | null
          recording_url?: string | null
          reminder_15m_sent?: boolean
          reminder_live_sent?: boolean
          scheduled_at: string
          status?: string
          stream_url?: string | null
          thumbnail_url?: string | null
          title: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          host_name?: string
          id?: string
          performance_impact?: string | null
          recording_url?: string | null
          reminder_15m_sent?: boolean
          reminder_live_sent?: boolean
          scheduled_at?: string
          status?: string
          stream_url?: string | null
          thumbnail_url?: string | null
          title?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      weekly_reports: {
        Row: {
          created_at: string
          id: string
          metrics: Json
          summary: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          metrics?: Json
          summary: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          metrics?: Json
          summary?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      xp_events: {
        Row: {
          amount: number
          context: Json
          created_at: string
          id: string
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          context?: Json
          created_at?: string
          id?: string
          source: string
          user_id: string
        }
        Update: {
          amount?: number
          context?: Json
          created_at?: string
          id?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      leaderboard_stats: {
        Row: {
          avatar_url: string | null
          avg_r: number | null
          best_trade: number | null
          display_name: string | null
          pnl_30d: number | null
          pnl_7d: number | null
          total_pnl: number | null
          total_trades: number | null
          user_id: string | null
          win_rate: number | null
        }
        Relationships: []
      }
      user_mt_accounts_safe: {
        Row: {
          account_type: string | null
          balance: number | null
          broker_name: string | null
          created_at: string | null
          currency: string | null
          equity: number | null
          free_margin: number | null
          has_metaapi_token: boolean | null
          has_password: boolean | null
          id: string | null
          last_error: string | null
          last_synced_at: string | null
          leverage: number | null
          login: string | null
          margin: number | null
          margin_level: number | null
          metaapi_account_id: string | null
          nickname: string | null
          platform: string | null
          region: string | null
          server_name: string | null
          status: string | null
          status_message: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_type?: string | null
          balance?: number | null
          broker_name?: string | null
          created_at?: string | null
          currency?: string | null
          equity?: number | null
          free_margin?: number | null
          has_metaapi_token?: never
          has_password?: never
          id?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          leverage?: number | null
          login?: string | null
          margin?: number | null
          margin_level?: number | null
          metaapi_account_id?: string | null
          nickname?: string | null
          platform?: string | null
          region?: string | null
          server_name?: string | null
          status?: string | null
          status_message?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_type?: string | null
          balance?: number | null
          broker_name?: string | null
          created_at?: string | null
          currency?: string | null
          equity?: number | null
          free_margin?: number | null
          has_metaapi_token?: never
          has_password?: never
          id?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          leverage?: number | null
          login?: string | null
          margin?: number | null
          margin_level?: number | null
          metaapi_account_id?: string | null
          nickname?: string | null
          platform?: string | null
          region?: string | null
          server_name?: string | null
          status?: string | null
          status_message?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      award_xp: {
        Args: {
          _amount: number
          _context?: Json
          _source: string
          _user_id: string
        }
        Returns: {
          created_at: string
          current_streak: number
          id: string
          last_activity_date: string | null
          level: number
          longest_streak: number
          total_xp: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_xp"
          isOneToOne: true
          isSetofReturn: false
        }
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
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
