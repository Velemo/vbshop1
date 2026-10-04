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
      announcements: {
        Row: {
          active: boolean
          button_label: string | null
          button_url: string | null
          created_at: string
          id: string
          media_type: string
          media_url: string | null
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          button_label?: string | null
          button_url?: string | null
          created_at?: string
          id?: string
          media_type?: string
          media_url?: string | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          button_label?: string | null
          button_url?: string | null
          created_at?: string
          id?: string
          media_type?: string
          media_url?: string | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prize_mail: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          label: string
          position: number
          prize_link: string | null
          prize_text: string
          prize_video_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          label?: string
          position: number
          prize_link?: string | null
          prize_text?: string
          prize_video_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          label?: string
          position?: number
          prize_link?: string | null
          prize_text?: string
          prize_video_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_contents: {
        Row: {
          content_link: string | null
          content_text: string
          created_at: string
          delivered_at: string | null
          delivered_to: string | null
          delivery_order: number
          media_url: string | null
          product_id: string
          updated_at: string
        }
        Insert: {
          content_link?: string | null
          content_text?: string
          created_at?: string
          delivered_at?: string | null
          delivered_to?: string | null
          delivery_order?: never
          media_url?: string | null
          product_id: string
          updated_at?: string
        }
        Update: {
          content_link?: string | null
          content_text?: string
          created_at?: string
          delivered_at?: string | null
          delivered_to?: string | null
          delivery_order?: never
          media_url?: string | null
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_contents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_mail: {
        Row: {
          content_link: string | null
          content_order: number
          content_text: string
          created_at: string
          id: string
          media_url: string | null
          paid_vb: number
          product_id: string
          product_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content_link?: string | null
          content_order: number
          content_text?: string
          created_at?: string
          id?: string
          media_url?: string | null
          paid_vb: number
          product_id: string
          product_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content_link?: string | null
          content_order?: number
          content_text?: string
          created_at?: string
          id?: string
          media_url?: string | null
          paid_vb?: number
          product_id?: string
          product_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_mail_content_order_fkey"
            columns: ["content_order"]
            isOneToOne: true
            referencedRelation: "product_contents"
            referencedColumns: ["delivery_order"]
          },
          {
            foreignKeyName: "product_mail_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          description: string
          gallery: Json
          id: string
          image_url: string | null
          name: string
          price: number
          promo_ends_at: string | null
          promo_price: number | null
          seller_whatsapp: string
          stock: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          gallery?: Json
          id?: string
          image_url?: string | null
          name: string
          price?: number
          promo_ends_at?: string | null
          promo_price?: number | null
          seller_whatsapp?: string
          stock?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          gallery?: Json
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          promo_ends_at?: string | null
          promo_price?: number | null
          seller_whatsapp?: string
          stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recharge_codes: {
        Row: {
          amount: number
          code: string
          created_at: string
          id: string
          redeemed_at: string | null
          redeemed_by: string | null
        }
        Insert: {
          amount: number
          code: string
          created_at?: string
          id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string
          id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string
          created_at: string
          id: string
          product_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string
          created_at?: string
          id?: string
          product_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      roulette_prize_content: {
        Row: {
          created_at: string
          position: number
          prize_link: string | null
          prize_text: string
          prize_video_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          position: number
          prize_link?: string | null
          prize_text?: string
          prize_video_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          position?: number
          prize_link?: string | null
          prize_text?: string
          prize_video_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roulette_prize_content_position_fkey"
            columns: ["position"]
            isOneToOne: true
            referencedRelation: "roulette_slots"
            referencedColumns: ["position"]
          },
        ]
      }
      roulette_slots: {
        Row: {
          image_url: string | null
          label: string
          position: number
          updated_at: string
        }
        Insert: {
          image_url?: string | null
          label?: string
          position: number
          updated_at?: string
        }
        Update: {
          image_url?: string | null
          label?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      roulette_spins: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          label: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          label?: string
          position: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          label?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      site_visits: {
        Row: {
          created_at: string
          id: string
          path: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          path?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          tickets: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          tickets?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          tickets?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      buy_product_vb: { Args: { _product_id: string }; Returns: number }
      buy_tickets: { Args: { _qty: number }; Returns: undefined }
      global_spins: {
        Args: never
        Returns: {
          created_at: string
          image_url: string
          label: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      redeem_code: { Args: { _code: string }; Returns: number }
      spin_roulette: { Args: never; Returns: number }
    }
    Enums: {
      app_role: "admin" | "user"
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
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
