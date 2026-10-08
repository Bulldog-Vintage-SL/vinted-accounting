import type { WorkflowStep } from "../types";
import type { SearchOrder } from "./types";

const WALLA_ORDER: Record<SearchOrder, string> = {
  relevance: "most_relevance",
  price_asc: "price_low_to_high",
  price_desc: "price_high_to_low",
  newest: "newest",
};

/** Madrid por defecto si no hay ubicación; Wallapop exige lat/lng en search/section. */
const DEFAULT_LAT = 40.4172;
const DEFAULT_LNG = -3.684;

function buildWallapopSearchUrl(input: {
  query: string;
  page: number;
  priceFrom?: number | null;
  priceTo?: number | null;
  order?: SearchOrder;
  latitude?: number | null;
  longitude?: number | null;
  nextPage?: string | null;
  searchId?: string | null;
}): string {
  const searchId = input.searchId || crypto.randomUUID();
  const params = new URLSearchParams({
    keywords: input.query.trim(),
    source: "search_box",
    search_id: searchId,
    latitude: String(input.latitude ?? DEFAULT_LAT),
    longitude: String(input.longitude ?? DEFAULT_LNG),
    order_by: WALLA_ORDER[input.order ?? "relevance"],
    search_country: "ES",
    section_type: "organic_search_results",
  });

  if (input.priceFrom != null && Number.isFinite(input.priceFrom)) {
    params.set("min_sale_price", String(input.priceFrom));
  }
  if (input.priceTo != null && Number.isFinite(input.priceTo)) {
    params.set("max_sale_price", String(input.priceTo));
  }

  // Página 2+: Wallapop usa next_page (token), no un índice numérico.
  if (input.page > 1 && input.nextPage) {
    params.set("next_page", input.nextPage);
  }

  return `https://api.wallapop.com/api/v3/search/section?${params.toString()}`;
}

export function buildSearchWallapopCatalogSteps(payload: {
  query: string;
  page?: number;
  perPage?: number;
  priceFrom?: number | null;
  priceTo?: number | null;
  order?: SearchOrder;
  latitude?: number | null;
  longitude?: number | null;
  nextPage?: string | null;
  searchId?: string | null;
}): WorkflowStep[] {
  const query = payload.query?.trim();
  if (!query) {
    throw new Error("Falta el texto de búsqueda");
  }

  return [
    {
      id: crypto.randomUUID(),
      platform: "wallapop",
      type: "SEARCH_WALLA_CATALOG",
      request: {
        method: "GET",
        url: buildWallapopSearchUrl({
          query,
          page: payload.page ?? 1,
          priceFrom: payload.priceFrom,
          priceTo: payload.priceTo,
          order: payload.order,
          latitude: payload.latitude,
          longitude: payload.longitude,
          nextPage: payload.nextPage,
          searchId: payload.searchId,
        }),
      },
    },
  ];
}
