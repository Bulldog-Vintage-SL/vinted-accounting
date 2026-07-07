export interface Account {
  id: string;
  platform: string;
  profile_link?: string | null;
  external_id: string;
  account_name?: string | null;
  sync_status: "OK" | "NEEDS_SYNC" | "ACCOUNT_NOT_FOUND" | "connected";
  created_at: string;
  vestiaire_id?: string | null;
  shopify_shop_domain?: string | null;
}

export type SyncStatus = "OK" | "NEEDS_SYNC" | "ACCOUNT_NOT_FOUND";
