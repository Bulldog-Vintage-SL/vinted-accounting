import { getAppUrl } from "@/libs/app-url";

export type EbayEnvironment = "sandbox" | "production";

export interface EbayTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  token_type: string;
  scope?: string;
}

export interface EbayUserIdentity {
  userId: string;
  username: string;
  accountType?: string;
  registrationMarketplaceId?: string;
}

const EBAY_SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
];

function getEnvironment(): EbayEnvironment {
  return process.env.EBAY_ENVIRONMENT === "production" ? "production" : "sandbox";
}

function getClientId(): string {
  const clientId = process.env.EBAY_CLIENT_ID;
  if (!clientId) {
    throw new Error("EBAY_CLIENT_ID is not configured");
  }
  return clientId;
}

function getClientSecret(): string {
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error("EBAY_CLIENT_SECRET is not configured");
  }
  return clientSecret;
}

function getRuName(): string {
  const ruName = process.env.EBAY_RUNAME;
  if (!ruName) {
    throw new Error("EBAY_RUNAME is not configured");
  }
  return ruName;
}

function getAuthBaseUrl(env: EbayEnvironment): string {
  return env === "production"
    ? "https://auth.ebay.com/oauth2/authorize"
    : "https://auth.sandbox.ebay.com/oauth2/authorize";
}

function getTokenUrl(env: EbayEnvironment): string {
  return env === "production"
    ? "https://api.ebay.com/identity/v1/oauth2/token"
    : "https://api.sandbox.ebay.com/identity/v1/oauth2/token";
}

function getIdentityUrl(env: EbayEnvironment): string {
  return env === "production"
    ? "https://apiz.ebay.com/commerce/identity/v1/user/"
    : "https://apiz.sandbox.ebay.com/commerce/identity/v1/user/";
}

export function getEbayApiBaseUrl(): string {
  return getEnvironment() === "production"
    ? "https://api.ebay.com"
    : "https://api.sandbox.ebay.com";
}

export function isEbayProduction(): boolean {
  return getEnvironment() === "production";
}

const VALID_MARKETPLACE_IDS = new Set([
  "EBAY_US",
  "EBAY_GB",
  "EBAY_ES",
  "EBAY_DE",
  "EBAY_FR",
  "EBAY_IT",
  "EBAY_AU",
  "EBAY_CA",
]);

/**
 * Normaliza cualquier valor de marketplace a un enum válido de eBay.
 * Evita el error 2004 "Could not serialize field [marketplaceId]" cuando
 * llega null, "", "EBAY-ES", "ES", etc.
 */
export function normalizeEbayMarketplaceId(
  value?: string | null
): string | null {
  if (!value || typeof value !== "string") return null;
  const cleaned = value.trim().toUpperCase().replace(/-/g, "_");
  if (VALID_MARKETPLACE_IDS.has(cleaned)) return cleaned;
  if (cleaned === "ES" || cleaned === "SPAIN") return "EBAY_ES";
  if (cleaned === "US" || cleaned === "USA") return "EBAY_US";
  if (cleaned === "UK" || cleaned === "GB") return "EBAY_GB";
  if (cleaned === "DE" || cleaned === "FR" || cleaned === "IT" || cleaned === "AU" || cleaned === "CA") {
    return `EBAY_${cleaned}`;
  }
  return null;
}

export function getEbayMarketplaceId(): string {
  // El sandbox de eBay solo funciona de forma coherente con el marketplace
  // de EEUU: los items se indexan por idioma (en-US) y una oferta para otro
  // marketplace no los encuentra (error 25751).
  if (!isEbayProduction()) return "EBAY_US";
  return (
    normalizeEbayMarketplaceId(process.env.EBAY_MARKETPLACE_ID) || "EBAY_ES"
  );
}

const CURRENCY_BY_MARKETPLACE: Record<string, string> = {
  EBAY_US: "USD",
  EBAY_GB: "GBP",
  EBAY_ES: "EUR",
  EBAY_DE: "EUR",
  EBAY_FR: "EUR",
  EBAY_IT: "EUR",
};

export function getEbayCurrency(marketplaceId: string): string {
  return CURRENCY_BY_MARKETPLACE[marketplaceId] ?? "EUR";
}

const CONTENT_LANGUAGE_BY_MARKETPLACE: Record<string, string> = {
  EBAY_ES: "es-ES",
  EBAY_DE: "de-DE",
  EBAY_FR: "fr-FR",
  EBAY_IT: "it-IT",
  EBAY_GB: "en-GB",
  EBAY_US: "en-US",
};

export function getEbayContentLanguage(marketplaceId?: string): string {
  // El sandbox de eBay solo soporta bien el marketplace de EEUU: con un
  // Content-Language distinto de en-US responde con el error 25709
  // "Invalid value for header Accept-Language".
  if (getEnvironment() !== "production") return "en-US";
  const id =
    normalizeEbayMarketplaceId(marketplaceId) || getEbayMarketplaceId();
  return CONTENT_LANGUAGE_BY_MARKETPLACE[id] ?? "es-ES";
}

/** Normalize eBay scope URLs to short names for storage, e.g. sell.account */
export function normalizeEbayScopesForStorage(scope?: string | null): string {
  if (!scope?.trim()) return "";

  return scope
    .trim()
    .split(/\s+/)
    .map((entry) => {
      const short = entry.split("/").pop() ?? entry;
      return short.replace(/^api_scope$/, "base");
    })
    .filter(Boolean)
    .join(" ");
}

export function hasEbaySellAccountScope(scope?: string | null): boolean {
  if (!scope?.trim()) return false;
  return (
    scope.includes("sell.account") || scope.includes("api_scope/sell.account")
  );
}

export function getRequestedEbayScopes(): string[] {
  return [...EBAY_SCOPES];
}

function getBasicAuthHeader(): string {
  const credentials = Buffer.from(
    `${getClientId()}:${getClientSecret()}`
  ).toString("base64");
  return `Basic ${credentials}`;
}

export function getEbayOAuthRedirectUri(): string {
  return `${getAppUrl()}/api/ebay/callback`;
}

export function buildEbayAuthorizeUrl(state: string): string {
  const env = getEnvironment();
  const params = new URLSearchParams({
    client_id: getClientId(),
    response_type: "code",
    redirect_uri: getRuName(),
    scope: EBAY_SCOPES.join(" "),
    state,
  });

  return `${getAuthBaseUrl(env)}?${params.toString()}`;
}

/** eBay returns URL-encoded codes containing ^ and # — decode once for token exchange. */
export function normalizeEbayAuthorizationCode(rawCode: string): string {
  let code = rawCode.trim();
  try {
    code = decodeURIComponent(code);
  } catch {
    // keep raw value if already decoded
  }
  return code;
}

export class EbayOAuthError extends Error {
  constructor(
    message: string,
    readonly details?: string
  ) {
    super(message);
    this.name = "EbayOAuthError";
  }
}

export async function exchangeEbayAuthorizationCode(
  code: string
): Promise<EbayTokenResponse> {
  const env = getEnvironment();
  const normalizedCode = normalizeEbayAuthorizationCode(code);
  const res = await fetch(getTokenUrl(env), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: getBasicAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: normalizedCode,
      redirect_uri: getRuName(),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new EbayOAuthError("eBay token exchange failed", body);
  }

  return res.json();
}

export async function refreshEbayAccessToken(
  refreshToken: string
): Promise<EbayTokenResponse> {
  const env = getEnvironment();
  const res = await fetch(getTokenUrl(env), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: getBasicAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: EBAY_SCOPES.join(" "),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`eBay token refresh failed: ${body}`);
  }

  return res.json();
}

export async function getEbayUserIdentity(
  accessToken: string
): Promise<EbayUserIdentity> {
  const env = getEnvironment();
  const res = await fetch(getIdentityUrl(env), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`eBay identity lookup failed: ${body}`);
  }

  return res.json();
}

export function buildEbayProfileUrl(
  username: string,
  marketplaceId?: string
): string {
  const hostByMarketplace: Record<string, string> = {
    EBAY_ES: "www.ebay.es",
    EBAY_DE: "www.ebay.de",
    EBAY_FR: "www.ebay.fr",
    EBAY_IT: "www.ebay.it",
    EBAY_GB: "www.ebay.co.uk",
    EBAY_US: "www.ebay.com",
  };

  const host = marketplaceId
    ? hostByMarketplace[marketplaceId] ?? "www.ebay.com"
    : "www.ebay.com";

  return `https://${host}/usr/${encodeURIComponent(username)}`;
}

export function getEbayTokenExpiryDate(expiresInSeconds: number): Date {
  return new Date(Date.now() + expiresInSeconds * 1000);
}

export function isEbayOAuthConfigured(): boolean {
  return Boolean(
    process.env.EBAY_CLIENT_ID &&
      process.env.EBAY_CLIENT_SECRET &&
      process.env.EBAY_RUNAME
  );
}

export function getEbaySetupInfo() {
  return {
    configured: isEbayOAuthConfigured(),
    callbackUrl: getEbayOAuthRedirectUri(),
    environment: getEnvironment(),
    portalUrl:
      getEnvironment() === "production"
        ? "https://developer.ebay.com/my/auth?env=production&index=0"
        : "https://developer.ebay.com/my/auth?env=sandbox&index=0",
  };
}
