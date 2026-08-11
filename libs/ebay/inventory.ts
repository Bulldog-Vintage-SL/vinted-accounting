import type { IListing } from "@/models/Listing";
import { ebayApiRequest, EbayApiError } from "@/libs/ebay/api";
import { getEbayCurrency } from "@/libs/ebay/client";
import {
  buildInventoryItemPayload,
  buildListingSku,
  getDefaultCategoryId,
  resolveEbayLeafCategoryId,
} from "@/libs/ebay/mappers";
import type { EbayListingPolicies } from "@/libs/ebay/policies";

interface EbayOffer {
  offerId: string;
  sku: string;
  status?: string;
  listingId?: string;
  pricingSummary?: { price?: { value?: string; currency?: string } };
  categoryId?: string;
}

interface OfferListResponse {
  offers?: EbayOffer[];
  total?: number;
}

interface InventoryItemResponse {
  sku: string;
  product?: {
    title?: string;
    description?: string;
    imageUrls?: string[];
    aspects?: Record<string, string[]>;
  };
  condition?: string;
  availability?: {
    shipToLocationAvailability?: { quantity?: number };
  };
}

export async function listEbayOffers(
  accessToken: string,
  limit = 100,
  offset = 0
): Promise<EbayOffer[]> {
  const data = await ebayApiRequest<OfferListResponse>(
    accessToken,
    "GET",
    `/sell/inventory/v1/offer?limit=${limit}&offset=${offset}`
  );
  return data.offers ?? [];
}

export async function getEbayInventoryItem(
  accessToken: string,
  sku: string
): Promise<InventoryItemResponse | null> {
  try {
    return await ebayApiRequest<InventoryItemResponse>(
      accessToken,
      "GET",
      `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`
    );
  } catch (err) {
    if (err instanceof Error && "status" in err && (err as { status: number }).status === 404) {
      return null;
    }
    throw err;
  }
}

export async function getEbayOffersBySku(
  accessToken: string,
  sku: string
): Promise<EbayOffer[]> {
  try {
    const data = await ebayApiRequest<OfferListResponse>(
      accessToken,
      "GET",
      `/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}`
    );
    return data.offers ?? [];
  } catch (err) {
    // eBay responde 404 (25713 "This Offer is not available") cuando el SKU
    // aún no tiene ofertas, en lugar de devolver una lista vacía.
    if (err instanceof EbayApiError && err.status === 404) {
      return [];
    }
    throw err;
  }
}

export async function upsertEbayInventoryItem(
  accessToken: string,
  listing: IListing,
  sku: string,
  options?: { marketplaceId?: string; categoryId?: string }
) {
  const payload = await buildInventoryItemPayload(listing, sku, {
    accessToken,
    marketplaceId: options?.marketplaceId,
    categoryId: options?.categoryId ?? getDefaultCategoryId(listing),
  });
  await ebayApiRequest(
    accessToken,
    "PUT",
    `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
    payload
  );
}

export async function createEbayOffer(
  accessToken: string,
  listing: IListing,
  sku: string,
  policies: EbayListingPolicies,
  categoryId?: string
): Promise<string> {
  const resolvedCategoryId =
    categoryId ??
    (await resolveEbayLeafCategoryId(
      accessToken,
      policies.marketplaceId,
      listing
    ));
  const created = await ebayApiRequest<{ offerId: string }>(
    accessToken,
    "POST",
    "/sell/inventory/v1/offer",
    {
      sku,
      marketplaceId: policies.marketplaceId,
      format: "FIXED_PRICE",
      categoryId: resolvedCategoryId,
      merchantLocationKey: policies.merchantLocationKey,
      listingDescription: listing.description ?? "",
      listingPolicies: {
        fulfillmentPolicyId: policies.fulfillmentPolicyId,
        paymentPolicyId: policies.paymentPolicyId,
        returnPolicyId: policies.returnPolicyId,
      },
      pricingSummary: {
        price: {
          value: String(listing.price ?? 0),
          currency: getEbayCurrency(policies.marketplaceId),
        },
      },
      quantity: listing.stock ?? 1,
      includeCatalogProductDetails: false,
    }
  );
  return created.offerId;
}

export async function updateEbayOffer(
  accessToken: string,
  offerId: string,
  listing: IListing,
  sku: string,
  policies: EbayListingPolicies,
  categoryId?: string
) {
  const resolvedCategoryId =
    categoryId ??
    (await resolveEbayLeafCategoryId(
      accessToken,
      policies.marketplaceId,
      listing
    ));
  await ebayApiRequest(
    accessToken,
    "PUT",
    `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`,
    {
      sku,
      marketplaceId: policies.marketplaceId,
      format: "FIXED_PRICE",
      categoryId: resolvedCategoryId,
      merchantLocationKey: policies.merchantLocationKey,
      listingDescription: listing.description ?? "",
      listingPolicies: {
        fulfillmentPolicyId: policies.fulfillmentPolicyId,
        paymentPolicyId: policies.paymentPolicyId,
        returnPolicyId: policies.returnPolicyId,
      },
      pricingSummary: {
        price: {
          value: String(listing.price ?? 0),
          currency: getEbayCurrency(policies.marketplaceId),
        },
      },
      quantity: listing.stock ?? 1,
      includeCatalogProductDetails: false,
    }
  );
}

export async function publishEbayOffer(
  accessToken: string,
  offerId: string
): Promise<string> {
  const published = await ebayApiRequest<{ listingId?: string }>(
    accessToken,
    "POST",
    `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`
  );
  if (!published.listingId) {
    throw new Error("eBay no devolvió listingId al publicar");
  }
  return published.listingId;
}

export async function withdrawEbayOffer(
  accessToken: string,
  offerId: string
) {
  await ebayApiRequest(
    accessToken,
    "POST",
    `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/withdraw`
  );
}

export async function deleteEbayOffer(accessToken: string, offerId: string) {
  await ebayApiRequest(
    accessToken,
    "DELETE",
    `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`
  );
}

function isNonLeafCategoryError(err: unknown): boolean {
  return (
    err instanceof EbayApiError &&
    err.status === 400 &&
    (/not a leaf category/i.test(err.body) || /"errorId":25005/.test(err.body))
  );
}

export async function deleteEbayInventoryItem(
  accessToken: string,
  sku: string
) {
  await ebayApiRequest(
    accessToken,
    "DELETE",
    `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`
  );
}

export async function publishListingToEbay(
  accessToken: string,
  listing: IListing,
  policies: EbayListingPolicies
) {
  const sku = buildListingSku(listing);
  // Obligatorio: categoría hoja (error 25005 si usamos 11450/15724).
  const categoryId = await resolveEbayLeafCategoryId(
    accessToken,
    policies.marketplaceId,
    listing
  );

  // La condición válida depende de la categoría: hay que resolverla ANTES
  // de publicar el offer (error 25059 si USED_GOOD se usa en moda).
  await upsertEbayInventoryItem(accessToken, listing, sku, {
    marketplaceId: policies.marketplaceId,
    categoryId,
  });

  const existingOffers = await getEbayOffersBySku(accessToken, sku);
  let offer =
    existingOffers.find((item) => item.status === "PUBLISHED") ??
    existingOffers[0];

  let offerId = offer?.offerId;

  // Ofertas draft antiguas (p. ej. con categoryId 11450) a menudo no se
  // "curan" bien con un PUT: las borramos y recreamos con la categoría hoja.
  if (offerId && offer?.status !== "PUBLISHED") {
    try {
      await deleteEbayOffer(accessToken, offerId);
    } catch {
      // Si el delete falla, intentamos update + publish igual
    }
    offerId = undefined;
    offer = undefined;
  }

  if (offerId) {
    await updateEbayOffer(
      accessToken,
      offerId,
      listing,
      sku,
      policies,
      categoryId
    );
  } else {
    offerId = await createEbayOffer(
      accessToken,
      listing,
      sku,
      policies,
      categoryId
    );
  }

  let listingId = offer?.listingId;
  if (!listingId || offer?.status !== "PUBLISHED") {
    try {
      listingId = await publishEbayOffer(accessToken, offerId);
    } catch (err) {
      if (!isNonLeafCategoryError(err)) throw err;

      // Categoría aún no-hoja: recrear oferta con otro candidato verificado
      try {
        await deleteEbayOffer(accessToken, offerId);
      } catch {
        // ignore
      }

      const retryCategoryId = await resolveEbayLeafCategoryId(
        accessToken,
        policies.marketplaceId,
        listing
      );
      await upsertEbayInventoryItem(accessToken, listing, sku, {
        marketplaceId: policies.marketplaceId,
        categoryId: retryCategoryId,
      });
      offerId = await createEbayOffer(
        accessToken,
        listing,
        sku,
        policies,
        retryCategoryId
      );
      listingId = await publishEbayOffer(accessToken, offerId);
    }
  }

  return { sku, offerId, listingId };
}

export type { EbayOffer, InventoryItemResponse };

export { buildListingSku };
