import {
  getEbayApiBaseUrl,
  getEbayContentLanguage,
  getEbayMarketplaceId,
  normalizeEbayMarketplaceId,
} from "@/libs/ebay/client";

export class EbayApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string
  ) {
    super(message);
    this.name = "EbayApiError";
  }
}

/**
 * Convierte errores de eBay en mensajes accionables para el usuario.
 * p.ej. SELLING_PRIVILEGE_REQUIRED → enlace de onboarding de vendedor.
 */
export function getEbayUserFacingErrorMessage(err: unknown): string | null {
  if (!(err instanceof EbayApiError)) return null;
  const text = `${err.message}\n${err.body}`;

  if (
    /SELLING_PRIVILEGE_REQUIRED/i.test(text) ||
    (/cuenta de vendedor/i.test(text) && /"errorId":25002/.test(text))
  ) {
    let onboardUrl: string | null = null;
    try {
      const parsed = JSON.parse(err.body) as {
        errors?: Array<{ parameters?: Array<{ name?: string; value?: string }> }>;
      };
      for (const e of parsed.errors || []) {
        for (const p of e.parameters || []) {
          if (p.value?.startsWith("https://")) {
            onboardUrl = p.value;
            break;
          }
        }
        if (onboardUrl) break;
      }
    } catch {
      // ignore parse errors
    }

    return (
      "Tu cuenta de eBay aún no tiene privilegios de vendedor activos. " +
      "Completa el alta de vendedor en eBay España y vuelve a publicar." +
      (onboardUrl ? ` Enlace: ${onboardUrl}` : " Abre: https://www.ebay.es/sl/sell")
    );
  }

  return null;
}

function stripNullish(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value.map(stripNullish).filter((v) => v !== undefined);
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = stripNullish(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return value;
}

export async function ebayApiRequest<T = unknown>(
  accessToken: string,
  method: string,
  path: string,
  body?: unknown,
  options?: { marketplaceId?: string }
): Promise<T> {
  const marketplaceId =
    normalizeEbayMarketplaceId(options?.marketplaceId) ||
    getEbayMarketplaceId();
  const language = getEbayContentLanguage(marketplaceId);

  const cleanedBody =
    body === undefined ? undefined : stripNullish(body);

  const res = await fetch(`${getEbayApiBaseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Content-Language": language,
      "Accept-Language": language,
      // Requerido por muchas Sell APIs; sin él el body marketplaceId a veces
      // falla al deserializar (error 2004).
      "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
    },
    body:
      cleanedBody === undefined ? undefined : JSON.stringify(cleanedBody),
  });

  const text = await res.text();
  if (!res.ok) {
    const preview =
      cleanedBody !== undefined
        ? ` | sent marketplaceId=${marketplaceId} bodyKeys=${Object.keys((cleanedBody as object) || {}).join(",")}`
        : ` | marketplaceId=${marketplaceId}`;
    throw new EbayApiError(
      `eBay API ${method} ${path} failed (${res.status})${preview}`,
      res.status,
      text
    );
  }

  if (!text) return {} as T;
  return JSON.parse(text) as T;
}
