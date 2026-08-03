import type { IListing } from "@/models/Listing";

const CONDITION_MAP: Record<string, string> = {
  nuevo: "NEW",
  "como nuevo": "LIKE_NEW",
  bueno: "USED_GOOD",
  aceptable: "USED_ACCEPTABLE",
  new: "NEW",
  "like new": "LIKE_NEW",
  good: "USED_GOOD",
  fair: "USED_ACCEPTABLE",
};

export function mapConditionToEbay(condition?: string | null): string {
  if (!condition) return "USED_GOOD";
  const key = condition.trim().toLowerCase();
  return CONDITION_MAP[key] ?? "USED_GOOD";
}

export function buildListingSku(listing: Pick<IListing, "_id" | "sku">): string {
  if (listing.sku?.trim()) {
    return listing.sku.trim().slice(0, 50);
  }
  const id = listing._id?.toString() ?? "";
  return `RL-${id.slice(-12)}`.toUpperCase();
}

export function getDefaultCategoryId(
  listing: Pick<IListing, "attributes" | "itemType">
): string {
  const fromAttributes = (listing.attributes as Record<string, unknown> | undefined)
    ?.ebayCategoryId;
  if (typeof fromAttributes === "string" && fromAttributes.trim()) {
    return fromAttributes.trim();
  }
  if (listing.itemType?.trim()) {
    return listing.itemType.trim();
  }
  return process.env.EBAY_DEFAULT_CATEGORY_ID || "11450";
}

export function buildEbayListingUrl(
  listingId: string,
  marketplaceId = process.env.EBAY_MARKETPLACE_ID || "EBAY_ES"
): string {
  const hostByMarketplace: Record<string, string> = {
    EBAY_ES: "www.ebay.es",
    EBAY_DE: "www.ebay.de",
    EBAY_FR: "www.ebay.fr",
    EBAY_IT: "www.ebay.it",
    EBAY_GB: "www.ebay.co.uk",
    EBAY_US: "www.ebay.com",
  };
  const host = hostByMarketplace[marketplaceId] ?? "www.ebay.com";
  return `https://${host}/itm/${listingId}`;
}

export function mapEbayOfferStatus(status?: string | null): string {
  if (!status) return "draft";
  if (status === "PUBLISHED") return "active";
  if (status === "UNPUBLISHED") return "draft";
  if (status === "ENDED") return "archived";
  return status.toLowerCase();
}

export function buildInventoryItemPayload(
  listing: IListing,
  sku: string
) {
  const brand = (listing.attributes as Record<string, unknown> | undefined)?.brand;
  const aspects: Record<string, string[]> = {};
  if (typeof brand === "string" && brand.trim()) {
    aspects.Brand = [brand.trim()];
  }
  if (listing.colors?.length) {
    aspects.Color = listing.colors.map(String);
  }
  if (listing.gender) {
    aspects.Department = [listing.gender];
  }

  return {
    sku,
    locale: "es_ES",
    product: {
      title: listing.title?.slice(0, 80) ?? "Artículo",
      description: listing.description ?? "",
      imageUrls: (listing.photoUrl ?? []).slice(0, 12),
      aspects: Object.keys(aspects).length ? aspects : undefined,
    },
    condition: mapConditionToEbay(listing.condition),
    availability: {
      shipToLocationAvailability: {
        quantity: listing.stock ?? 1,
      },
    },
  };
}
