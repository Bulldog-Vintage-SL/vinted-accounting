import {
  getEbayApiBaseUrl,
  getEbayContentLanguage,
  getEbayCurrency,
  getEbayMarketplaceId,
  normalizeEbayMarketplaceId,
  type EbayTokenResponse,
} from "@/libs/ebay/client";
import { EbayApiError } from "@/libs/ebay/api";
import type {
  MarketplaceSearchItem,
  MarketplaceSearchPage,
  SearchOrder,
} from "@/lib/workflows/search/types";

function isEbayBrowseConfigured(): boolean {
  return Boolean(
    process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET
  );
}

interface EbayItemSummary {
  itemId?: string;
  title?: string;
  price?: { value?: string; currency?: string };
  image?: { imageUrl?: string };
  thumbnailImages?: Array<{ imageUrl?: string }>;
  itemWebUrl?: string;
  condition?: string;
  seller?: { username?: string };
  brand?: string;
}

interface EbaySearchResponse {
  total?: number;
  offset?: number;
  limit?: number;
  itemSummaries?: EbayItemSummary[];
}

const SORT_BY_ORDER: Record<SearchOrder, string | null> = {
  relevance: null,
  price_asc: "price",
  price_desc: "priceDescending",
  newest: "newlyListed",
};

let cachedAppToken: { token: string; expiresAt: number } | null = null;

function getBasicAuthHeader(): string {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("EBAY_CLIENT_ID / EBAY_CLIENT_SECRET no configurados");
  }
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

function getTokenUrl(): string {
  return process.env.EBAY_ENVIRONMENT === "production"
    ? "https://api.ebay.com/identity/v1/oauth2/token"
    : "https://api.sandbox.ebay.com/identity/v1/oauth2/token";
}

/** Token de aplicación (client_credentials) para Browse API pública. */
export async function getEbayApplicationToken(): Promise<string> {
  if (cachedAppToken && Date.now() < cachedAppToken.expiresAt - 60_000) {
    return cachedAppToken.token;
  }

  const res = await fetch(getTokenUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: getBasicAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`eBay application token failed: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as EbayTokenResponse;
  cachedAppToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

function buildPriceFilter(
  priceFrom?: number | null,
  priceTo?: number | null,
  currency?: string
): string | null {
  const hasFrom = priceFrom != null && Number.isFinite(priceFrom);
  const hasTo = priceTo != null && Number.isFinite(priceTo);
  if (!hasFrom && !hasTo) return null;

  const min = hasFrom ? String(priceFrom) : "";
  const max = hasTo ? String(priceTo) : "";
  const cur = currency || "EUR";
  return `price:[${min}..${max}],priceCurrency:${cur}`;
}

export async function searchEbayCatalog(input: {
  query: string;
  page?: number;
  perPage?: number;
  priceFrom?: number | null;
  priceTo?: number | null;
  order?: SearchOrder;
  marketplaceId?: string | null;
}): Promise<MarketplaceSearchPage> {
  if (!isEbayBrowseConfigured()) {
    return {
      platform: "ebay",
      items: [],
      page: input.page ?? 1,
      perPage: input.perPage ?? 24,
      totalPages: null,
      totalEntries: null,
      error: "eBay no está configurado (faltan EBAY_CLIENT_ID / SECRET)",
    };
  }

  const page = Math.max(1, input.page ?? 1);
  const perPage = Math.min(200, Math.max(1, input.perPage ?? 24));
  const offset = (page - 1) * perPage;
  const marketplaceId =
    normalizeEbayMarketplaceId(input.marketplaceId) || getEbayMarketplaceId();
  const currency = getEbayCurrency(marketplaceId);
  const language = getEbayContentLanguage(marketplaceId);

  const params = new URLSearchParams({
    q: input.query.trim(),
    limit: String(perPage),
    offset: String(offset),
  });

  const sort = SORT_BY_ORDER[input.order ?? "relevance"];
  if (sort) params.set("sort", sort);

  const priceFilter = buildPriceFilter(
    input.priceFrom,
    input.priceTo,
    currency
  );
  if (priceFilter) params.set("filter", priceFilter);

  const accessToken = await getEbayApplicationToken();
  const res = await fetch(
    `${getEbayApiBaseUrl()}/buy/browse/v1/item_summary/search?${params}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Accept-Language": language,
        "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
      },
    }
  );

  const text = await res.text();
  if (!res.ok) {
    throw new EbayApiError(
      `eBay Browse search failed (${res.status})`,
      res.status,
      text
    );
  }

  const data = (text ? JSON.parse(text) : {}) as EbaySearchResponse;
  const summaries = Array.isArray(data.itemSummaries) ? data.itemSummaries : [];
  const total = data.total != null ? Number(data.total) : null;

  const items: MarketplaceSearchItem[] = summaries.map((item) => {
    const id = String(item.itemId ?? "");
    const amount = item.price?.value != null ? Number(item.price.value) : null;
    return {
      id,
      platform: "ebay",
      title: item.title?.trim() || "Sin título",
      price: Number.isFinite(amount as number) ? amount : null,
      currency: item.price?.currency || currency,
      photoUrl:
        item.image?.imageUrl ||
        item.thumbnailImages?.[0]?.imageUrl ||
        null,
      url: item.itemWebUrl || null,
      brand: item.brand || null,
      condition: item.condition || null,
      seller: item.seller?.username || null,
    };
  });

  return {
    platform: "ebay",
    items,
    page,
    perPage,
    totalPages:
      total != null && perPage > 0
        ? Math.max(1, Math.ceil(total / perPage))
        : null,
    totalEntries: total,
    error: null,
  };
}
