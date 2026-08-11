import type { IListing } from "@/models/Listing";
import {
  getEbayContentLanguage,
  getEbayMarketplaceId,
  isEbayProduction,
} from "@/libs/ebay/client";
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

/** Padres conocidos de moda/bolsos por marketplace para buscar un leaf. */
const FASHION_PARENT_BY_MARKETPLACE: Record<string, string> = {
  EBAY_US: "15724", // Women's Bags & Handbags (puede no ser leaf)
  EBAY_ES: "260019",
  EBAY_GB: "169291",
  EBAY_DE: "15724",
  EBAY_FR: "15724",
  EBAY_IT: "15724",
};

/**
 * Candidatos leaf por marketplace. En sandbox la Taxonomy API miente sobre
 * leafCategoryTreeNode, así que probamos estos IDs contra
 * getItemAspectsForCategory (solo funciona en categorías hoja).
 */
const LEAF_CANDIDATES_BY_MARKETPLACE: Record<string, string[]> = {
  EBAY_US: [
    "163570", // Clutches & Evening Bags
    "169291", // Shoulder Bags
    "45258", // Crossbody Bags
    "15687", // Women's Accessories
    "30120", // Common sandbox example category
    "9355", // Cell Phones (sandbox-friendly leaf)
  ],
  EBAY_ES: ["260023", "15724", "163570"],
  EBAY_GB: ["163570", "169291"],
  EBAY_DE: ["163570", "169291"],
  EBAY_FR: ["163570", "169291"],
  EBAY_IT: ["163570", "169291"],
};

export function getDefaultCategoryId(
  listing: Pick<IListing, "attributes" | "itemType">
): string {
  const fromAttributes = (listing.attributes as Record<string, unknown> | undefined)
    ?.ebayCategoryId;
  if (typeof fromAttributes === "string" && fromAttributes.trim()) {
    return fromAttributes.trim();
  }
  if (typeof fromAttributes === "number") {
    return String(fromAttributes);
  }
  if (listing.itemType?.trim() && /^\d+$/.test(listing.itemType.trim())) {
    return listing.itemType.trim();
  }
  // Nunca devolver 11450 (raíz). Preferir leaf conocido o env.
  return (
    process.env.EBAY_DEFAULT_CATEGORY_ID ||
    LEAF_CANDIDATES_BY_MARKETPLACE[getEbayMarketplaceId()]?.[0] ||
    "163570"
  );
}

interface TaxonomyCategoryNode {
  category?: { categoryId?: string; categoryName?: string };
  leafCategoryTreeNode?: boolean;
  childCategoryTreeNodes?: TaxonomyCategoryNode[];
}

function findFirstLeafId(node: TaxonomyCategoryNode | undefined): string | null {
  if (!node) return null;
  if (node.leafCategoryTreeNode && node.category?.categoryId) {
    return String(node.category.categoryId);
  }
  for (const child of node.childCategoryTreeNodes ?? []) {
    const found = findFirstLeafId(child);
    if (found) return found;
  }
  // Sin flag leaf pero sin hijos → tratar como leaf
  if (
    (!node.childCategoryTreeNodes || node.childCategoryTreeNodes.length === 0) &&
    node.category?.categoryId
  ) {
    return String(node.category.categoryId);
  }
  return null;
}

async function getEbayCategoryTreeId(
  accessToken: string,
  marketplaceId: string
): Promise<string | null> {
  try {
    const data = await ebayApiRequest<{ categoryTreeId?: string }>(
      accessToken,
      "GET",
      `/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=${marketplaceId}`
    );
    return data.categoryTreeId ? String(data.categoryTreeId) : null;
  } catch {
    return null;
  }
}

async function suggestLeafCategoryId(
  accessToken: string,
  treeId: string,
  query: string
): Promise<string | null> {
  try {
    const data = await ebayApiRequest<{
      categorySuggestions?: Array<{
        category?: { categoryId?: string };
      }>;
    }>(
      accessToken,
      "GET",
      `/commerce/taxonomy/v1/category_tree/${treeId}/get_category_suggestions` +
        `?q=${encodeURIComponent(query)}`
    );
    const id = data.categorySuggestions?.[0]?.category?.categoryId;
    return id ? String(id) : null;
  } catch {
    return null;
  }
}

async function leafFromSubtree(
  accessToken: string,
  treeId: string,
  categoryId: string
): Promise<string | null> {
  try {
    const data = await ebayApiRequest<{
      categorySubtreeNode?: TaxonomyCategoryNode;
    }>(
      accessToken,
      "GET",
      `/commerce/taxonomy/v1/category_tree/${treeId}/get_category_subtree` +
        `?category_id=${encodeURIComponent(categoryId)}`
    );
    return findFirstLeafId(data.categorySubtreeNode);
  } catch {
    return null;
  }
}

/** getItemAspectsForCategory solo responde OK en categorías hoja. */
async function isVerifiedLeafCategory(
  accessToken: string,
  treeId: string,
  categoryId: string
): Promise<boolean> {
  try {
    await ebayApiRequest(
      accessToken,
      "GET",
      `/commerce/taxonomy/v1/category_tree/${treeId}/get_item_aspects_for_category` +
        `?category_id=${encodeURIComponent(categoryId)}`
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Resuelve un categoryId HOJA válido para el marketplace.
 * Evita el error 25005 ("The category selected is not a leaf category").
 */
export async function resolveEbayLeafCategoryId(
  accessToken: string,
  marketplaceId: string,
  listing: Pick<IListing, "title" | "attributes" | "itemType" | "description">
): Promise<string> {
  const configured = getDefaultCategoryId(listing);
  const treeId = await getEbayCategoryTreeId(accessToken, marketplaceId);
  const candidates = [
    process.env.EBAY_DEFAULT_CATEGORY_ID,
    configured,
    ...(LEAF_CANDIDATES_BY_MARKETPLACE[marketplaceId] ??
      LEAF_CANDIDATES_BY_MARKETPLACE.EBAY_US),
  ].filter((id, idx, arr): id is string => Boolean(id) && arr.indexOf(id) === idx);

  // En sandbox NO confiamos en leafCategoryTreeNode (devuelve basura).
  // Verificamos cada candidato con getItemAspectsForCategory.
  if (treeId) {
    for (const candidate of candidates) {
      if (await isVerifiedLeafCategory(accessToken, treeId, candidate)) {
        return candidate;
      }
    }

    if (isEbayProduction()) {
      const query = [listing.title, listing.itemType]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (query) {
        const suggested = await suggestLeafCategoryId(
          accessToken,
          treeId,
          query
        );
        if (
          suggested &&
          (await isVerifiedLeafCategory(accessToken, treeId, suggested))
        ) {
          return suggested;
        }
      }

      const parent =
        FASHION_PARENT_BY_MARKETPLACE[marketplaceId] ??
        FASHION_PARENT_BY_MARKETPLACE.EBAY_US;
      const fromParent = await leafFromSubtree(accessToken, treeId, parent);
      if (
        fromParent &&
        (await isVerifiedLeafCategory(accessToken, treeId, fromParent))
      ) {
        return fromParent;
      }
    }
  }

  // Último recurso: primer candidato (mejor que 11450)
  return candidates[0] || "163570";
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

const COLOR_ES_TO_EN: Record<string, string> = {
  negro: "Black",
  blanco: "White",
  rojo: "Red",
  azul: "Blue",
  verde: "Green",
  amarillo: "Yellow",
  gris: "Gray",
  rosa: "Pink",
  naranja: "Orange",
  marron: "Brown",
  marrón: "Brown",
  beige: "Beige",
  dorado: "Gold",
  plateado: "Silver",
  multicolor: "Multicolor",
};

const DEPARTMENT_MAP: Record<string, string> = {
  mujer: "Women",
  hombre: "Men",
  unisex: "Unisex Adults",
  female: "Women",
  male: "Men",
};

function normalizeKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function mapListingColorToEbay(color: string): string {
  const key = normalizeKey(color);
  return COLOR_ES_TO_EN[key] ?? color;
}

interface CategoryAspect {
  localizedAspectName?: string;
  aspectConstraint?: {
    aspectRequired?: boolean;
    aspectMode?: string;
    itemToAspectCardinality?: string;
  };
  aspectValues?: Array<{ localizedValue?: string }>;
}

async function fetchCategoryAspects(
  accessToken: string,
  marketplaceId: string,
  categoryId: string
): Promise<CategoryAspect[]> {
  const treeId = await getEbayCategoryTreeId(accessToken, marketplaceId);
  if (!treeId) return [];

  try {
    const data = await ebayApiRequest<{ aspects?: CategoryAspect[] }>(
      accessToken,
      "GET",
      `/commerce/taxonomy/v1/category_tree/${treeId}/get_item_aspects_for_category` +
        `?category_id=${encodeURIComponent(categoryId)}`
    );
    return data.aspects ?? [];
  } catch {
    return [];
  }
}

function pickAspectValue(
  aspect: CategoryAspect,
  preferred: string[]
): string | null {
  const allowed = (aspect.aspectValues ?? [])
    .map((v) => v.localizedValue)
    .filter((v): v is string => Boolean(v));

  for (const pref of preferred) {
    if (!pref) continue;
    const exact = allowed.find((a) => a.toLowerCase() === pref.toLowerCase());
    if (exact) return exact;
    const partial = allowed.find(
      (a) =>
        a.toLowerCase().includes(pref.toLowerCase()) ||
        pref.toLowerCase().includes(a.toLowerCase())
    );
    if (partial) return partial;
    // FREE_TEXT: aceptar el valor preferido aunque no esté en la lista
    if (
      allowed.length === 0 ||
      aspect.aspectConstraint?.aspectMode === "FREE_TEXT"
    ) {
      return pref;
    }
  }

  // Aspecto obligatorio sin valor del listing: primer valor permitido
  if (aspect.aspectConstraint?.aspectRequired && allowed[0]) {
    return allowed[0];
  }

  return null;
}

/**
 * Construye product.aspects con los item specifics requeridos por la
 * categoría (Color, Brand, Size…). Evita el error 25002.
 */
export async function resolveEbayProductAspects(
  accessToken: string,
  marketplaceId: string,
  categoryId: string,
  listing: IListing
): Promise<Record<string, string[]>> {
  const attrs = (listing.attributes ?? {}) as Record<string, unknown>;
  const brand = typeof attrs.brand === "string" ? attrs.brand.trim() : "";
  const size = typeof attrs.size === "string" ? attrs.size.trim() : "";
  const colors = (listing.colors ?? []).map(mapListingColorToEbay);
  const department =
    DEPARTMENT_MAP[normalizeKey(listing.gender ?? "")] ?? listing.gender ?? "";

  const sourceByAspect: Record<string, string[]> = {
    color: colors.length ? colors : ["Black"],
    colour: colors.length ? colors : ["Black"],
    brand: brand ? [brand] : ["Unbranded"],
    size: size ? [size] : ["One Size"],
    department: department ? [department] : ["Women"],
    style: ["Casual"],
    material: ["Unknown"],
    pattern: ["Solid"],
    "outer shell material": ["Unknown"],
    "bag height": ["N/A"],
    "bag depth": ["N/A"],
    "bag width": ["N/A"],
  };

  const categoryAspects = await fetchCategoryAspects(
    accessToken,
    marketplaceId,
    categoryId
  );

  const aspects: Record<string, string[]> = {};

  if (categoryAspects.length === 0) {
    // Sin metadata: enviar al menos Color/Brand (los más comunes en moda)
    aspects.Color = sourceByAspect.color;
    if (brand) aspects.Brand = [brand];
    if (size) aspects.Size = [size];
    return aspects;
  }

  for (const aspect of categoryAspects) {
    const name = aspect.localizedAspectName;
    if (!name) continue;

    const key = normalizeKey(name);
    const preferred = sourceByAspect[key] ?? [];
    const required = Boolean(aspect.aspectConstraint?.aspectRequired);

    // Solo rellenamos aspectos requeridos o los que tenemos valor claro
    if (!required && preferred.length === 0) continue;

    const value = pickAspectValue(
      aspect,
      preferred.length ? preferred : required ? ["Black", "Other", "N/A"] : []
    );
    if (value) {
      aspects[name] = [value];
    }
  }

  // Garantía mínima: Color siempre (error 25002 más frecuente)
  if (!Object.keys(aspects).some((k) => normalizeKey(k) === "color")) {
    aspects.Color = sourceByAspect.color;
  }

  return aspects;
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
  let aspects: Record<string, string[]> = {};

  if (options?.accessToken && options.categoryId) {
    aspects = await resolveEbayProductAspects(
      options.accessToken,
      options.marketplaceId || getEbayMarketplaceId(),
      options.categoryId,
      listing
    );
  } else {
    const brand = (listing.attributes as Record<string, unknown> | undefined)
      ?.brand;
    if (typeof brand === "string" && brand.trim()) {
      aspects.Brand = [brand.trim()];
    }
    aspects.Color = (listing.colors?.length
      ? listing.colors
      : ["Black"]
    ).map(mapListingColorToEbay);
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
