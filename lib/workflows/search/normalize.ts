import type { MarketplaceSearchItem, MarketplaceSearchPage } from "./types";

function toPrice(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === "object") {
    const obj = value as { amount?: unknown; cash_amount?: unknown };
    if (obj.amount != null) return toPrice(obj.amount);
    if (obj.cash_amount != null) return toPrice(obj.cash_amount);
  }
  return null;
}

export function normalizeVintedSearchResult(
  result: any,
  page: number,
  perPage: number
): MarketplaceSearchPage {
  const itemsRaw = Array.isArray(result?.items) ? result.items : [];
  const pagination = result?.pagination ?? {};
  const limit = Math.min(96, Math.max(1, perPage));

  const items: MarketplaceSearchItem[] = itemsRaw.slice(0, limit).map((item: any) => {
    const p = item.productItem || item;
    const id = String(p.id ?? item.id ?? item.item_id ?? "");
    const photo =
      p.photo?.url ||
      p.photos?.[0]?.url ||
      p.thumbnailUrl ||
      item.photo?.url ||
      item.photos?.[0]?.url ||
      item.photo?.full_size_url ||
      null;

    return {
      id,
      platform: "vinted",
      title: (p.title || item.title)?.trim() || "Sin título",
      price: toPrice(p.price ?? item.price),
      currency:
        p.price?.currency_code ||
        p.price?.currencyCode ||
        item.price?.currency_code ||
        item.currency ||
        "EUR",
      photoUrl: photo,
      url:
        p.url ||
        item.url ||
        (id ? `https://www.vinted.es/items/${id}` : null),
      brand: p.brand_title || item.brand_title || item.brand?.title || null,
      size: p.size_title || item.size_title || item.size?.title || null,
      condition: p.status || item.status || item.condition || null,
      seller: p.user?.login || item.user?.login || item.user?.login_name || null,
    };
  });

  return {
    platform: "vinted",
    items,
    page: Number(pagination.current_page ?? page) || page,
    perPage: limit,
    totalPages:
      pagination.total_pages != null ? Number(pagination.total_pages) : null,
    totalEntries:
      pagination.total_entries != null
        ? Number(pagination.total_entries)
        : null,
  };
}

function extractWallapopItems(result: any): any[] {
  const candidates = [
    // Respuesta real de /api/v3/search/section
    result?.data?.section?.items,
    result?.section?.items,
    result?.data?.section?.payload?.items,
    result?.section?.payload?.items,
    result?.data?.payload?.items,
    result?.payload?.items,
    result?.data?.search_objects,
    result?.search_objects,
    result?.items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) return candidate;
  }

  // A veces los items vienen repartidos en components[].
  const components =
    result?.data?.components ||
    result?.components ||
    result?.data?.section?.components ||
    [];
  if (Array.isArray(components)) {
    const fromComponents = components.flatMap(
      (component: any) =>
        component?.payload?.items ||
        component?.items ||
        component?.payload?.search_objects ||
        []
    );
    if (fromComponents.length) return fromComponents;
  }

  return [];
}

export function normalizeWallapopSearchResult(
  result: any,
  page: number,
  perPage: number,
  searchId?: string | null
): MarketplaceSearchPage {
  const itemsRaw = extractWallapopItems(result);

  const items: MarketplaceSearchItem[] = itemsRaw.map((raw: any) => {
    const item = raw?.item || raw?.payload || raw;
    const id = String(item.id ?? item.item_id ?? "");
    const images = item.images || item.image || item.pictures || [];
    const firstImage = Array.isArray(images) ? images[0] : images;
    const photo =
      firstImage?.urls?.big ||
      firstImage?.urls?.medium ||
      firstImage?.urls?.small ||
      firstImage?.url ||
      item.image?.url ||
      null;

    const webSlug = item.web_slug || item.webSlug;
    const url =
      item.url ||
      (webSlug
        ? `https://es.wallapop.com/item/${webSlug}`
        : id
          ? `https://es.wallapop.com/item/${id}`
          : null);

    return {
      id,
      platform: "wallapop",
      title: item.title?.trim() || "Sin título",
      price: toPrice(item.price ?? item.pricing?.price ?? item.sale_price),
      currency:
        item.price?.currency ||
        item.pricing?.price?.currency ||
        item.currency ||
        "EUR",
      photoUrl: photo,
      url,
      brand: item.brand || null,
      size: item.size || null,
      condition: item.condition?.name || item.condition || null,
      seller: item.user?.micro_name || item.user?.name || null,
    };
  });

  const meta = result?.meta || result?.data?.meta || result?.data?.section?.meta || {};
  const nextPage =
    meta.next_page ||
    result?.data?.next_page ||
    result?.next_page ||
    null;
  const total =
    meta.total ??
    result?.data?.meta?.total ??
    result?.total ??
    null;

  return {
    platform: "wallapop",
    items,
    page,
    perPage,
    totalPages:
      total != null && perPage > 0
        ? Math.max(1, Math.ceil(Number(total) / perPage))
        : nextPage
          ? page + 1
          : page,
    totalEntries: total != null ? Number(total) : null,
    nextPage: nextPage ?? null,
    searchId: searchId ?? null,
  };
}
