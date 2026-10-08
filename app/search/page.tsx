"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Search,
  Loader2,
  ExternalLink,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  searchMarketplaces,
  type MarketplaceSearchItem,
  type MarketplaceSearchPage,
  type SearchOrder,
  type SearchPlatform,
} from "@/lib/external-integrations/search-functions";

const PLATFORM_OPTIONS: { id: SearchPlatform; label: string; icon: string }[] = [
  { id: "vinted", label: "Vinted", icon: "/icons/vinted.svg" },
  { id: "wallapop", label: "Wallapop", icon: "/icons/wallapop.svg" },
  { id: "ebay", label: "eBay", icon: "/icons/ebay.svg" },
];

const ORDER_OPTIONS: { value: SearchOrder; label: string }[] = [
  { value: "relevance", label: "Relevancia" },
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
  { value: "newest", label: "Más recientes" },
];

const PER_PAGE = 24;

function formatPrice(item: MarketplaceSearchItem): string {
  if (item.price == null) return "—";
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: item.currency || "EUR",
      maximumFractionDigits: 2,
    }).format(item.price);
  } catch {
    return `${item.price} ${item.currency || "EUR"}`;
  }
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [priceFrom, setPriceFrom] = useState("");
  const [priceTo, setPriceTo] = useState("");
  const [order, setOrder] = useState<SearchOrder>("relevance");
  const [platforms, setPlatforms] = useState<SearchPlatform[]>([
    "vinted",
    "wallapop",
    "ebay",
  ]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<MarketplaceSearchItem[]>([]);
  const [pages, setPages] = useState<MarketplaceSearchPage[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const maxTotalPages = useMemo(() => {
    const totals = pages
      .map((p) => p.totalPages)
      .filter((n): n is number => typeof n === "number" && n > 0);
    if (!totals.length) return items.length > 0 ? page : 1;
    return Math.max(...totals, page);
  }, [pages, items.length, page]);

  const togglePlatform = (platform: SearchPlatform) => {
    setPlatforms((prev) => {
      if (prev.includes(platform)) {
        if (prev.length === 1) return prev;
        return prev.filter((p) => p !== platform);
      }
      return [...prev, platform];
    });
  };

  const runSearch = async (nextPage = 1) => {
    const text = query.trim();
    if (!text) {
      setError("Escribe qué quieres buscar");
      return;
    }
    if (!platforms.length) {
      setError("Elige al menos un marketplace");
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);
    setPage(nextPage);

    try {
      const wallaPrev = pages.find((p) => p.platform === "wallapop");
      const result = await searchMarketplaces({
        query: text,
        page: nextPage,
        perPage: PER_PAGE,
        priceFrom: priceFrom ? Number(priceFrom) : null,
        priceTo: priceTo ? Number(priceTo) : null,
        order,
        platforms,
        // Wallapop pagina con token, no con índice.
        nextPage:
          nextPage > 1 && wallaPrev?.nextPage ? wallaPrev.nextPage : null,
        searchId:
          nextPage > 1 && wallaPrev?.searchId ? wallaPrev.searchId : null,
      });

      setPages(result.pages);
      setItems(result.items);

      const failed = result.pages.filter((p) => p.error);
      if (!result.items.length && failed.length === result.pages.length) {
        setError(
          failed.map((p) => `${p.platform}: ${p.error}`).join(" · ") ||
            "No se pudo buscar. Abre Vinted/Wallapop con sesión e inténtalo de nuevo."
        );
      } else if (failed.length) {
        setError(
          `Algunos marketplaces fallaron: ${failed
            .map((p) => `${p.platform} (${p.error})`)
            .join(" · ")}`
        );
      }
    } catch (err) {
      setItems([]);
      setPages([]);
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void runSearch(1);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Búsqueda
          </h1>
          <p className="text-gray-500 mt-1">
            Busca anuncios en Vinted, Wallapop y eBay. Vinted/Wallapop usan la
            extensión; eBay va por API OAuth.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5 space-y-4"
        >
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ej. camiseta blanca"
                className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Buscar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="text-sm text-gray-600 space-y-1">
              <span>Precio mínimo</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={priceFrom}
                onChange={(e) => setPriceFrom(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              />
            </label>
            <label className="text-sm text-gray-600 space-y-1">
              <span>Precio máximo</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={priceTo}
                onChange={(e) => setPriceTo(e.target.value)}
                placeholder="100"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              />
            </label>
            <label className="text-sm text-gray-600 space-y-1 md:col-span-2">
              <span>Orden</span>
              <select
                value={order}
                onChange={(e) => setOrder(e.target.value as SearchOrder)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"
              >
                {ORDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {PLATFORM_OPTIONS.map((platform) => {
              const active = platforms.includes(platform.id);
              return (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => togglePlatform(platform.id)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition ${
                    active
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <img
                    src={platform.icon}
                    alt=""
                    className="w-4 h-4 rounded-sm object-contain"
                  />
                  {platform.label}
                </button>
              );
            })}
          </div>
        </form>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            Buscando en marketplaces…
          </div>
        )}

        {!loading && hasSearched && !items.length && !error && (
          <div className="text-center py-16 text-gray-500">
            No hay resultados para esta búsqueda.
          </div>
        )}

        {!loading && items.length > 0 && (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-gray-500">
                {items.length} resultados en esta página
                {pages.some((p) => p.totalEntries != null) &&
                  ` · ~${Math.max(
                    ...pages.map((p) => p.totalEntries ?? 0)
                  )} en total`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loading || page <= 1}
                  onClick={() => void runSearch(page - 1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </button>
                <span className="text-sm text-gray-600">
                  {page} / {maxTotalPages}
                </span>
                <button
                  type="button"
                  disabled={loading || page >= maxTotalPages}
                  onClick={() => void runSearch(page + 1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm disabled:opacity-40"
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((item) => (
                <a
                  key={`${item.platform}-${item.id}`}
                  href={item.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:border-gray-300 transition"
                >
                  <div className="aspect-square bg-gray-100 relative">
                    {item.photoUrl ? (
                      <img
                        src={item.photoUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                        Sin foto
                      </div>
                    )}
                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-0.5 text-xs font-medium text-gray-800 capitalize">
                      <img
                        src={`/icons/${item.platform === "vinted" ? "vinted.svg" : "wallapop.svg"}`}
                        alt=""
                        className="w-3.5 h-3.5"
                      />
                      {item.platform}
                    </span>
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:underline">
                      {item.title}
                    </p>
                    <p className="text-base font-semibold text-gray-900">
                      {formatPrice(item)}
                    </p>
                    <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                      <span className="truncate">
                        {[item.brand, item.size].filter(Boolean).join(" · ") ||
                          "—"}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-60" />
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
