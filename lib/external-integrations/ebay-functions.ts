import {
  validateListingRequiredFields,
  MissingFieldsError,
  type UploadResult,
} from "./validators";

const EBAY_UPLOAD_TIMEOUT_MS = 120000;

async function fetchEbayUpload(
  listingId: string,
  accountId: string
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EBAY_UPLOAD_TIMEOUT_MS);

  try {
    return await fetch("/api/ebay/upload-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, accountId }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `La petición a eBay superó el tiempo límite (${EBAY_UPLOAD_TIMEOUT_MS}ms)`
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function uploadEbayItem(
  listing: {
    id: string
    title?: string | null
    description?: string | null
    price?: number | null
    photo_url?: string[]
  },
  accountId: string
): Promise<UploadResult> {
  try {
    const missing = validateListingRequiredFields(listing, "ebay");
    if (missing.length > 0) throw new MissingFieldsError(missing);

    const res = await fetchEbayUpload(listing.id, accountId);
    const data = await res.json();

    if (!res.ok || !data?.ok) {
      if (Array.isArray(data?.missingFields) && data.missingFields.length > 0) {
        throw new MissingFieldsError(data.missingFields);
      }
      return {
        ok: false,
        message: data?.error || "Error desconocido",
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

export async function syncEbayAccount(accountId: string) {
  const syncRes = await fetch("/api/ebay/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId }),
  });
  const syncData = await syncRes.json();

  if (!syncRes.ok || !syncData?.ok) {
    return {
      ok: false,
      message: syncData?.message ?? syncData?.error ?? "Error desconocido",
    };
  }

  const policiesRes = await fetch("/api/ebay/setup-policies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId }),
  });
  const policiesData = await policiesRes.json();

  if (!policiesRes.ok || !policiesData?.ok) {
    return {
      ok: false,
      message:
        policiesData?.error ??
        "Cuenta conectada, pero faltan permisos de políticas. Elimínala y vuelve a conectar eBay.",
    };
  }

  return {
    ok: true,
    message: "Cuenta de eBay y políticas de venta listas",
  };
}
