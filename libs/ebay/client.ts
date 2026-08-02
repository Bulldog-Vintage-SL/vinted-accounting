import { getAppUrl } from "@/libs/app-url";

export type EbayEnvironment = "sandbox" | "production";

export interface EbayTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  token_type: string;
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

export async function exchangeEbayAuthorizationCode(
  code: string
): Promise<EbayTokenResponse> {
  const env = getEnvironment();
  const res = await fetch(getTokenUrl(env), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: getBasicAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRuName(),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`eBay token exchange failed: ${body}`);
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
