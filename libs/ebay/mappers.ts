import type { IListing } from "@/models/Listing";
import { getEbayContentLanguage, getEbayMarketplaceId } from "@/libs/ebay/client";
import { ebayApiRequest } from "@/libs/ebay/api";

/**
 * Condiciones de nuestra app / Vinted → enum preferido de Inventory API.
 * En moda (apparel) eBay NO acepta USED_GOOD (5000); usa USED_EXCELLENT /
 * PRE_OWNED_* en su lugar. La resolución final se hace contra
 * getItemConditionPolicies para la categoría concreta.
 */
const CONDITION_MAP: Record<string, string> = {
  // App UI
  nuevo: "NEW",
  "como nuevo": "USED_EXCELLENT",
  bueno: "USED_EXCELLENT",
  aceptable: "USED_ACCEPTABLE",
  // Inglés
  new: "NEW",
  "like new": "USED_EXCELLENT",
  good: "USED_EXCELLENT",
  fair: "USED_ACCEPTABLE",
  // Vinted ES (import)
  "nuevo con etiquetas": "NEW",
  "nuevo sin etiquetas": "NEW_OTHER",
  "muy bueno": "USED_EXCELLENT",
  satisfactorio: "USED_ACCEPTABLE",
};

/** Condition ID numérico de eBay → ConditionEnum del Inventory API */
const CONDITION_ID_TO_ENUM: Record<string, string> = {
  "1000": "NEW",
  "1500": "NEW_OTHER",
  "1750": "NEW_WITH_DEFECTS",
  "2000": "CERTIFIED_REFURBISHED",
  "2500": "SELLER_REFURBISHED",
  "2750": "LIKE_NEW",
  "2990": "PRE_OWNED_EXCELLENT",
  "3000": "USED_EXCELLENT",
  "3010": "PRE_OWNED_FAIR",
  "4000": "USED_VERY_GOOD",
  "5000": "USED_GOOD",
  "6000": "USED_ACCEPTABLE",
  "7000": "FOR_PARTS_OR_NOT_WORKING",
};

/** Preferencia de fallback cuando el enum deseado no es válido en la categoría */
const CONDITION_FALLBACK_ORDER = [
  "USED_EXCELLENT",
  "PRE_OWNED_EXCELLENT",
  "USED_VERY_GOOD",
  "PRE_OWNED_FAIR",
  "NEW",
  "NEW_OTHER",
  "LIKE_NEW",
  "USED_GOOD",
  "USED_ACCEPTABLE",
  "NEW_WITH_DEFECTS",
];

export function mapConditionToEbay(condition?: string | null): string {
  if (!condition) return "USED_EXCELLENT";
  const key = condition
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return CONDITION_MAP[key] ?? "USED_EXCELLENT";
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
  if (listing.itemType?.trim() && /^\d+$/.test(listing.itemType.trim())) {
    return listing.itemType.trim();
  }
  // 11450 es la categoría raíz "Clothing, Shoes & Accessories" y no admite
  // listing directo con condiciones estándar. Usamos un leaf de moda/bolsos.
  return process.env.EBAY_DEFAULT_CATEGORY_ID || "15724";
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

interface ItemConditionPolicyResponse {
  itemConditionPolicies?: Array<{
    categoryId?: string;
    itemConditions?: Array<{
      conditionId?: string;
      conditionDescription?: string;
    }>;
  }>;
}

/**
 * Consulta las condiciones válidas para la categoría y elige el enum más
 * cercano al de nuestro listing. Evita el error 25059
 * ("Condition information X is not valid for category Y").
 */
export async function resolveEbayConditionForCategory(
  accessToken: string,
  marketplaceId: string,
  categoryId: string,
  listingCondition?: string | null
): Promise<string> {
  const preferred = mapConditionToEbay(listingCondition);

  try {
    const data = await ebayApiRequest<ItemConditionPolicyResponse>(
      accessToken,
      "GET",
      `/sell/metadata/v1/marketplace/${marketplaceId}/get_item_condition_policies` +
        `?filter=categoryIds:{${categoryId}}`
    );

    const allowedIds = new Set(
      (data.itemConditionPolicies ?? [])
        .flatMap((p) => p.itemConditions ?? [])
        .map((c) => String(c.conditionId ?? ""))
        .filter(Boolean)
    );

    if (allowedIds.size === 0) return preferred;

    const allowedEnums = new Set(
      [...allowedIds]
        .map((id) => CONDITION_ID_TO_ENUM[id])
        .filter((v): v is string => Boolean(v))
    );

    if (allowedEnums.has(preferred)) return preferred;

    for (const candidate of CONDITION_FALLBACK_ORDER) {
      if (allowedEnums.has(candidate)) return candidate;
    }

    // Último recurso: mapear el primer conditionId permitido
    const firstId = [...allowedIds][0];
    return CONDITION_ID_TO_ENUM[firstId] ?? preferred;
  } catch {
    // Si Metadata falla, usamos el enum preferido (mejor para moda que USED_GOOD)
    return preferred;
  }
}

export async function buildInventoryItemPayload(
  listing: IListing,
  sku: string,
  options?: {
    accessToken?: string;
    marketplaceId?: string;
    categoryId?: string;
  }
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

  let condition = mapConditionToEbay(listing.condition);
  if (options?.accessToken && options.categoryId) {
    condition = await resolveEbayConditionForCategory(
      options.accessToken,
      options.marketplaceId || getEbayMarketplaceId(),
      options.categoryId,
      listing.condition
    );
  }

  return {
    sku,
    // El campo locale usa guion bajo (es_ES), a diferencia del header
    // Content-Language (es-ES). Debe coincidir con el idioma enviado.
    locale: getEbayContentLanguage().replace("-", "_"),
    product: {
      title: listing.title?.slice(0, 80) ?? "Artículo",
      description: listing.description ?? "",
      imageUrls: (listing.photoUrl ?? []).slice(0, 12),
      aspects: Object.keys(aspects).length ? aspects : undefined,
    },
    condition,
    conditionDescription: listing.condition?.trim() || undefined,
    availability: {
      shipToLocationAvailability: {
        quantity: listing.stock ?? 1,
      },
    },
  };
}
