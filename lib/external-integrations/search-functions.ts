import { runFlow, extractErrorMessage } from "./extensionBridge";
import type {
  MarketplaceSearchPage,
  MarketplaceSearchQuery,
  SearchOrder,
  SearchPlatform,
} from "@/lib/workflows/search/types";

export type {
  MarketplaceSearchItem,
  MarketplaceSearchPage,
  MarketplaceSearchQuery,
  SearchOrder,
  SearchPlatform,
} from "@/lib/workflows/search/types";

const EXTENSION_PLATFORMS = new Set<SearchPlatform>(["vinted", "wallapop"]);

async function searchViaExtension(
  platform: "vinted" | "wallapop",
  query: MarketplaceSearchQuery
): Promise<MarketplaceSearchPage> {
  const flow =
    platform === "vinted" ? "SEARCH_VINTED_CATALOG" : "SEARCH_WALLAPOP_CATALOG";

  const page = query.page ?? 1;
  const perPage = query.perPage ?? 24;

  try {
    const searchId =
      platform === "wallapop"
        ? query.searchId || crypto.randomUUID()
        : null;

    const result = await runFlow(flow, {
      platform,
      query: query.query,
      page,
      perPage,
      priceFrom: query.priceFrom ?? null,
      priceTo: query.priceTo ?? null,
      order: query.order ?? "relevance",
      nextPage: query.nextPage ?? null,
      searchId,
    });

    if (!result?.ok || !result?.result?.done || result?.result?.error) {
      return {
        platform,
        items: [],
        page,
        perPage,
        totalPages: null,
        totalEntries: null,
        error: extractErrorMessage(
          result,
          typeof result?.result?.error === "string"
            ? result.result.error
            : `Error buscando en ${platform}`
        ),
      };
    }

    const searchPage = result.result.state?.searchPage as
      | MarketplaceSearchPage
      | undefined;

    if (!searchPage) {
      return {
        platform,
        items: [],
        page,
        perPage,
        totalPages: null,
        totalEntries: null,
        error: "La búsqueda no devolvió resultados",
      };
    }

    return { ...searchPage, error: null };
  } catch (err) {
    return {
      platform,
      items: [],
      page,
      perPage,
      totalPages: null,
      totalEntries: null,
      error: err instanceof Error ? err.message : "Error inesperado",
    };
  }
}

async function searchEbayViaApi(
  query: MarketplaceSearchQuery
): Promise<MarketplaceSearchPage> {
  const page = query.page ?? 1;
  const perPage = query.perPage ?? 24;

  try {
    const res = await fetch("/api/ebay/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: query.query,
        page,
        perPage,
        priceFrom: query.priceFrom ?? null,
        priceTo: query.priceTo ?? null,
        order: query.order ?? "relevance",
      }),
    });

    const data = await res.json();
    if (data?.page) {
      return data.page as MarketplaceSearchPage;
    }

    return {
      platform: "ebay",
      items: [],
      page,
      perPage,
      totalPages: null,
      totalEntries: null,
      error: data?.error || "Error buscando en eBay",
    };
  } catch (err) {
    return {
      platform: "ebay",
      items: [],
      page,
      perPage,
      totalPages: null,
      totalEntries: null,
      error: err instanceof Error ? err.message : "Error inesperado",
    };
  }
}

async function searchPlatform(
  platform: SearchPlatform,
  query: MarketplaceSearchQuery
): Promise<MarketplaceSearchPage> {
  if (platform === "ebay") return searchEbayViaApi(query);
  if (EXTENSION_PLATFORMS.has(platform)) {
    return searchViaExtension(platform as "vinted" | "wallapop", query);
  }
  return {
    platform,
    items: [],
    page: query.page ?? 1,
    perPage: query.perPage ?? 24,
    totalPages: null,
    totalEntries: null,
    error: `Marketplace no soportado: ${platform}`,
  };
}

export async function searchMarketplaces(
  query: MarketplaceSearchQuery
): Promise<{
  ok: boolean;
  pages: MarketplaceSearchPage[];
  items: MarketplaceSearchPage["items"];
}> {
  const text = query.query?.trim();
  if (!text) {
    return { ok: false, pages: [], items: [] };
  }

  const platforms: SearchPlatform[] = query.platforms?.length
    ? query.platforms
    : (["vinted", "wallapop", "ebay"] as SearchPlatform[]);

  // eBay (API) en paralelo; Vinted/Wallapop (extensión) en serie.
  const extensionPlatforms = platforms.filter((p) => EXTENSION_PLATFORMS.has(p));
  const apiPlatforms = platforms.filter((p) => !EXTENSION_PLATFORMS.has(p));

  const apiPromise = Promise.all(
    apiPlatforms.map((platform) =>
      searchPlatform(platform, { ...query, query: text })
    )
  );

  const extensionPages: MarketplaceSearchPage[] = [];
  for (const platform of extensionPlatforms) {
    extensionPages.push(
      await searchPlatform(platform, { ...query, query: text })
    );
  }

  const apiPages = await apiPromise;
  const pages = [...extensionPages, ...apiPages];

  const items = pages.flatMap((page) => page.items);
  const order = query.order ?? "relevance";

  if (order === "price_asc") {
    items.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  } else if (order === "price_desc") {
    items.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
  }

  return {
    ok: pages.some((page) => !page.error),
    pages,
    items,
  };
}
