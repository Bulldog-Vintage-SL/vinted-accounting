export type SearchPlatform = "vinted" | "wallapop" | "ebay";

export type SearchOrder =
  | "relevance"
  | "price_asc"
  | "price_desc"
  | "newest";

export interface MarketplaceSearchQuery {
  query: string;
  page?: number;
  perPage?: number;
  priceFrom?: number | null;
  priceTo?: number | null;
  order?: SearchOrder;
  platforms?: SearchPlatform[];
  /** Token de paginación Wallapop (`next_page` de la respuesta anterior). */
  nextPage?: string | null;
  /** Mismo `search_id` entre páginas Wallapop. */
  searchId?: string | null;
}

export interface MarketplaceSearchItem {
  id: string;
  platform: SearchPlatform;
  title: string;
  price: number | null;
  currency: string;
  photoUrl: string | null;
  url: string | null;
  brand?: string | null;
  size?: string | null;
  condition?: string | null;
  seller?: string | null;
}

export interface MarketplaceSearchPage {
  platform: SearchPlatform;
  items: MarketplaceSearchItem[];
  page: number;
  perPage: number;
  totalPages: number | null;
  totalEntries: number | null;
  error?: string | null;
  /** Token para la siguiente página (Wallapop). */
  nextPage?: string | null;
  /** search_id usado en la petición (Wallapop). */
  searchId?: string | null;
}
