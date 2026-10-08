import type { WorkflowStep } from "../types";
import type { SearchOrder } from "./types";

const VINTED_ORDER: Record<SearchOrder, string> = {
  relevance: "relevance",
  price_asc: "price_low_to_high",
  price_desc: "price_high_to_low",
  newest: "newest_first",
};

function buildVintedCatalogUrl(input: {
  query: string;
  page: number;
  priceFrom?: number | null;
  priceTo?: number | null;
  order?: SearchOrder;
}): string {
  // /api/v2/catalog/items → 404 desde sept 2026.
  // Los resultados van embebidos en el HTML SSR de /catalog.
  const params = new URLSearchParams({
    page: String(Math.max(1, input.page)),
    search_text: input.query.trim(),
    order: VINTED_ORDER[input.order ?? "relevance"],
  });

  if (input.priceFrom != null && Number.isFinite(input.priceFrom)) {
    params.set("price_from", String(input.priceFrom));
  }
  if (input.priceTo != null && Number.isFinite(input.priceTo)) {
    params.set("price_to", String(input.priceTo));
  }

  return `https://www.vinted.es/catalog?${params.toString()}`;
}

export function buildSearchVintedCatalogSteps(payload: {
  query: string;
  page?: number;
  perPage?: number;
  priceFrom?: number | null;
  priceTo?: number | null;
  order?: SearchOrder;
}): WorkflowStep[] {
  const query = payload.query?.trim();
  if (!query) {
    throw new Error("Falta el texto de búsqueda");
  }

  return [
    {
      id: crypto.randomUUID(),
      platform: "vinted",
      type: "SEARCH_VINTED_CATALOG",
      request: {
        method: "GET",
        url: buildVintedCatalogUrl({
          query,
          page: payload.page ?? 1,
          priceFrom: payload.priceFrom,
          priceTo: payload.priceTo,
          order: payload.order,
        }),
        skipDelay: true,
      },
    },
  ];
}
