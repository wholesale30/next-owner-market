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
  local_pickup_ok: boolean;
  weight_lbs: number | null;
  ai_generated: boolean;
  listed_at: string | null;
  sold_at: string | null;
  created_at: string;
  updated_at: string;
  item_photos?: ItemPhoto[];
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
