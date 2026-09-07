import {
  validateListingRequiredFields,
  MissingFieldsError,
  type UploadResult,
} from "./validators";
import { prepareListingForReupload } from "./prepare-reupload";
import type { Listing } from "@/app/inventory/listings/types";
import type { ListingPublishOverrides } from "@/libs/listings/overrides";

const SHOPIFY_UPLOAD_TIMEOUT_MS = 120000;

interface ShopifyListingInput {
  id: string;
  title?: string | null;
  description?: string | null;
  price?: number | null;
  photo_url?: string[];
}

async function fetchShopifyJson(
  url: string,
  body: Record<string, unknown>,
  timeoutMs = SHOPIFY_UPLOAD_TIMEOUT_MS
): Promise<{ res: Response; data: Record<string, unknown> }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await res.json()) as Record<string, unknown>;
    return { res, data };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `La petición a Shopify superó el tiempo límite (${timeoutMs}ms)`
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function uploadShopifyItem(
  listing: ShopifyListingInput,
  accountId: string,
  listingOverrides?: ListingPublishOverrides
): Promise<UploadResult> {
  try {
    const missing = validateListingRequiredFields(listing, "shopify");
    if (missing.length > 0) throw new MissingFieldsError(missing);

    const { res, data } = await fetchShopifyJson("/api/shopify/upload-product", {
      listingId: listing.id,
      accountId,
      ...(listingOverrides ? { listingOverrides } : {}),
    });

    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        message: (data?.error as string) || "Error desconocido",
      };
    }

    return {
      ok: true,
      data: data.publication,
    };
  } catch (err: unknown) {
    if (err instanceof MissingFieldsError) {
      return { ok: false, message: err.message, missingFields: err.fields };
    }
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Error inesperado",
    };
  }
}

export async function deleteShopifyItem(
  publicationId: string
): Promise<UploadResult> {
  try {
    const { res, data } = await fetchShopifyJson(
      "/api/shopify/delete-product",
      { publicationId },
      30000
    );

    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        message: (data?.error as string) || "Error al eliminar en Shopify",
      };
    }

    return {
      ok: true,
      message: "Publicación eliminada correctamente de Shopify y de la BD",
    };
  } catch (err: unknown) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Error inesperado",
    };
  }
}

export async function reuploadShopifyItem(
  accountId: string,
  listing: Listing,
  publicationId: string
): Promise<UploadResult> {
  try {
    const missing = validateListingRequiredFields(listing, "shopify");
    if (missing.length > 0) throw new MissingFieldsError(missing);

    const resDelete = await deleteShopifyItem(publicationId);
    if (!resDelete.ok) {
      return {
        ok: false,
        message: `No se pudo eliminar la publicación anterior: ${resDelete.message}`,
      };
    }

    const { modifiedListing, newTitle, newDescription } =
      await prepareListingForReupload(listing);

    const uploadResult = await uploadShopifyItem(modifiedListing, accountId, {
      title: modifiedListing.title,
      description: modifiedListing.description,
      photoUrl: modifiedListing.photo_url,
    });
    if (!uploadResult.ok) {
      return {
        ok: false,
        message: `Error al resubir el producto: ${uploadResult.message}`,
      };
    }

    return {
      ok: true,
      message: "Publicación resubida correctamente en Shopify",
      data: {
        listingId: listing.id,
        newTitle,
        newDescription,
        publication: uploadResult.data,
      },
    };
  } catch (err: unknown) {
    if (err instanceof MissingFieldsError) {
      return { ok: false, message: err.message, missingFields: err.fields };
    }
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Error inesperado",
    };
  }
}
