type MongoDoc = Record<string, unknown> & {
  _id?: { toString(): string };
  toJSON?: () => Record<string, unknown>;
};

function toPlain(doc: unknown): Record<string, unknown> {
  if (doc && typeof doc === "object" && "toJSON" in doc && typeof (doc as MongoDoc).toJSON === "function") {
    return (doc as MongoDoc).toJSON!();
  }
  return (doc as Record<string, unknown>) ?? {};
}

export function serializeListing(doc: unknown) {
  const raw = toPlain(doc);
  const tags = raw.tags;

  return {
    id: (raw.id as string) || raw._id?.toString() || "",
    profile_id:
      (raw.userId as { toString?: () => string })?.toString?.() ||
      (raw.userId as string) ||
      "",
    title: (raw.title as string) ?? "",
    sku: (raw.sku as string) ?? "",
    status: (raw.status as string) ?? "active",
    tags: Array.isArray(tags) ? tags.join(",") : ((tags as string) ?? ""),
    condition: (raw.condition as string) ?? "",
    description: (raw.description as string) ?? "",
    photo_url: (raw.photoUrl as string[]) ?? (raw.photo_url as string[]) ?? [],
    price: (raw.price as number) ?? 0,
    delivery_method:
      (raw.deliveryMethod as string) ?? (raw.delivery_method as string) ?? "",
    attributes: (raw.attributes as Record<string, unknown>) ?? {},
    created_at:
      (raw.createdAt as string) ?? (raw.created_at as string) ?? "",
    last_update:
      (raw.lastUpdate as string) ?? (raw.last_update as string) ?? "",
    colors: (raw.colors as string[]) ?? [],
    gender: raw.gender ?? null,
    item_type: (raw.itemType as string) ?? (raw.item_type as string) ?? null,
    stock: (raw.stock as number) ?? 1,
  };
}

export function serializePublication(doc: unknown) {
  const raw = toPlain(doc);
  const listing = raw.listingId as Record<string, unknown> | string | null | undefined;

  const listingData =
    listing && typeof listing === "object"
      ? {
          title: (listing.title as string) ?? "",
          photo_url:
            (listing.photoUrl as string[]) ??
            (listing.photo_url as string[]) ??
            [],
        }
      : null;

  return {
    id: (raw.id as string) || raw._id?.toString() || "",
    platform: raw.platform as string,
    status: (raw.status as string) ?? null,
    price: (raw.price as number) ?? null,
    sync_status:
      (raw.syncStatus as string) ?? (raw.sync_status as string) ?? null,
    external_id:
      (raw.externalId as string) ?? (raw.external_id as string) ?? "",
    last_sync:
      (raw.lastSync as string) ?? (raw.last_sync as string) ?? null,
    listing: listingData,
    publication_url:
      (raw.publicationUrl as string) ?? (raw.publication_url as string) ?? null,
    account_id:
      (raw.accountId as { toString?: () => string })?.toString?.() ||
      (raw.accountId as string) ||
      "",
  };
}

export function listingFormToMongo(
  body: Record<string, unknown>
): Record<string, unknown> {
  return {
    title: body.title,
    description: body.description,
    condition: body.condition,
    price: body.price === "" ? null : body.price,
    photoUrl: body.photo_url ?? body.photoUrl,
    colors: body.colors,
    attributes: body.attributes,
    gender: body.gender,
    itemType: body.item_type ?? body.itemType,
    stock: body.stock ?? 1,
    lastUpdate: new Date(),
  };
}
