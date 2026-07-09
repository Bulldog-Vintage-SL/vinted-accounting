type MongoDoc = Record<string, unknown> & {
  _id?: { toString(): string };
  toJSON?: () => Record<string, unknown>;
};

function toPlain(doc: unknown): Record<string, unknown> {
  if (
    doc &&
    typeof doc === "object" &&
    "toJSON" in doc &&
    typeof (doc as MongoDoc).toJSON === "function"
  ) {
    return (doc as MongoDoc).toJSON!();
  }
  return (doc as Record<string, unknown>) ?? {};
}

export function serializeAccount(doc: unknown) {
  const raw = toPlain(doc);

  return {
    id: (raw.id as string) || raw._id?.toString() || "",
    platform: (raw.platform as string) ?? "",
    profile_link:
      (raw.profileLink as string) ?? (raw.profile_link as string) ?? null,
    external_id:
      (raw.externalId as string) ?? (raw.external_id as string) ?? "",
    account_name:
      (raw.accountName as string) ?? (raw.account_name as string) ?? null,
    sync_status:
      (raw.syncStatus as string) ?? (raw.sync_status as string) ?? "NEEDS_SYNC",
    created_at:
      (raw.createdAt as string) ?? (raw.created_at as string) ?? "",
    vestiaire_id:
      (raw.vestiaireId as string) ?? (raw.vestiaire_id as string) ?? null,
    shopify_shop_domain:
      (raw.shopifyShopDomain as string) ??
      (raw.shopify_shop_domain as string) ??
      null,
    last_sync:
      (raw.lastSync as string) ?? (raw.last_sync as string) ?? null,
  };
}
