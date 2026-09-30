export type Role = "admin" | "staff" | "consignor" | "buyer";
export type ItemStatus =
  | "draft"
  | "pending_review"
  | "active"
  | "reserved"
  | "sold"
  | "shipped"
  | "returned"
  | "archived";
export type Condition = "new" | "like_new" | "good" | "fair" | "for_parts";
export type Tier = "full_service" | "drop_off" | "self_listed" | "owned";
export type Channel =
  | "storefront"
  | "facebook"
  | "offerup"
  | "ebay"
  | "craigslist"
  | "auction"
  | "in_person"
  | "other";

export interface Profile {
  id: string;
  role: Role;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  business_name: string | null;
  approved: boolean;
  default_commission_pct: number | null;
  default_tier: Tier | null;
  referral_code: string;
  stripe_account_id?: string | null;
  stripe_payouts_ready?: boolean;
  stripe_customer_id?: string | null;
  plan?: "free" | "pro";
  plan_renews_at?: string | null;
  completed_sales?: number;
  rating_avg?: number | null;
  rating_count?: number;
  suspended?: boolean;
  ai_credits?: number;
  pro_credit_months?: number;
  city?: string | null; state?: string | null; zip?: string | null; address1?: string | null; address2?: string | null;
  referral_count?: number;
}

export interface Category {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  sort_order: number;
}

export interface Location {
  id: string;
  code: string;
  kind: string;
  description: string | null;
  sorted: boolean;
}

export interface ItemVideo { id: string; item_id: string; kind: "upload" | "link"; url: string; storage_path: string | null; sort_order: number }

export interface ItemPhoto {
  id: string;
  item_id: string;
  storage_path: string;
  url: string;
  sort_order: number;
  is_primary: boolean;
}

export interface Item {
  id: string;
  sku: string;
  owner_id: string;
  title: string;
  description: string;
  category_id: string | null;
  condition: Condition | null;
  condition_notes: string | null;
  brand: string | null;
  model: string | null;
  specs: Record<string, string>;
  tags: string[];
  status: ItemStatus;
  sale_type: "fixed" | "auction" | "lot";
  price: number | null;
  price_min_suggested: number | null;
  price_max_suggested: number | null;
  cost: number | null;
  quantity: number;
  location_id: string | null;
  tier: Tier;
  commission_pct: number | null;
  tested: boolean;
  serviced: boolean;
  service_notes: string | null;
  shipping_ok: boolean;
  shipping_price?: number;
  shipping_mode?: "calculated" | "flat" | "free";
  box?: string | null;
  local_pickup_ok: boolean;
  weight_lbs: number | null;
  ai_generated: boolean;
  listed_at: string | null;
  sold_at: string | null;
  created_at: string;
  updated_at: string;
  item_photos?: ItemPhoto[];
  item_videos?: ItemVideo[];
  categories?: Pick<Category, "name" | "slug"> | null;
  locations?: Pick<Location, "code"> | null;
  profiles?: Pick<Profile, "full_name" | "business_name"> | null;
}

export const CONDITION_LABELS: Record<Condition, string> = {
  new: "New",
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
  for_parts: "For Parts / Not Working",
};

export const STATUS_LABELS: Record<ItemStatus, string> = {
  draft: "Draft",
  pending_review: "Needs Review",
  active: "Listed",
  reserved: "Reserved",
  sold: "Sold",
  shipped: "Shipped",
  returned: "Returned",
  archived: "Archived",
};

export const TIER_LABELS: Record<Tier, string> = {
  owned: "My inventory",
  full_service: "Full service consignment",
  drop_off: "Drop-off consignment",
  self_listed: "Self-listed consignment",
};

export type OrderStatus = "pending_payment" | "paid" | "released" | "refunded" | "disputed" | "cancelled";
export interface Order {
  id: string; item_id: string; buyer_id: string; seller_id: string; fulfillment: "pickup" | "ship";
  amount: number; shipping: number; total: number; commission_pct: number; commission_amount: number; seller_due: number;
  status: OrderStatus; pickup_code: string; tracking_carrier: string | null; tracking_number: string | null;
  shipped_at: string | null; delivered_at: string | null; release_after: string | null; expires_at: string | null;
  paid_at: string | null; released_at: string | null; refunded_at: string | null; buyer_note: string | null; created_at: string;
  shipping_address?: { name?: string; address?: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string } } | null;
  label_url?: string | null; label_cost?: number; tracking_url?: string | null; offer_id?: string | null; shipping_mode?: string;
}
