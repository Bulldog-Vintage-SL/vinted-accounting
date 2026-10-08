import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import { searchEbayCatalog } from "@/libs/ebay/browse";
import { EbayApiError, getEbayUserFacingErrorMessage } from "@/libs/ebay/api";
import type { SearchOrder } from "@/lib/workflows/search/types";

export const dynamic = "force-dynamic";

const VALID_ORDERS = new Set<SearchOrder>([
  "relevance",
  "price_asc",
  "price_desc",
  "newest",
]);

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) {
      return NextResponse.json({ error: "Falta el texto de búsqueda" }, { status: 400 });
    }

    const order: SearchOrder = VALID_ORDERS.has(body.order)
      ? body.order
      : "relevance";

    const page = await searchEbayCatalog({
      query,
      page: Number(body.page) || 1,
      perPage: Number(body.perPage) || 24,
      priceFrom:
        body.priceFrom != null && body.priceFrom !== ""
          ? Number(body.priceFrom)
          : null,
      priceTo:
        body.priceTo != null && body.priceTo !== ""
          ? Number(body.priceTo)
          : null,
      order,
      marketplaceId: body.marketplaceId ?? null,
    });

    return NextResponse.json({ ok: !page.error, page });
  } catch (err) {
    const friendly = getEbayUserFacingErrorMessage(err);
    const message =
      friendly ||
      (err instanceof EbayApiError
        ? `${err.message}: ${err.body.slice(0, 200)}`
        : err instanceof Error
          ? err.message
          : "Error buscando en eBay");

    return NextResponse.json(
      {
        ok: false,
        page: {
          platform: "ebay",
          items: [],
          page: 1,
          perPage: 24,
          totalPages: null,
          totalEntries: null,
          error: message,
        },
      },
      { status: 200 }
    );
  }
}
