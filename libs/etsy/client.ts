import crypto from "crypto";
import { getAppUrl } from "@/libs/app-url";

const KEY = process.env.ETSY_KEYSTRING!;
const SECRET = process.env.ETSY_SHARED_SECRET!;
const REDIRECT = `${getAppUrl()}/api/etsy/callback`;
const TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";
const API = "https://openapi.etsy.com";

export const SCOPES = [
  "listings_r",
  "listings_w",
  "listings_d",
  "shops_r",
  "shops_w",
  "transactions_r",
  "transactions_w",
  "email_r",
];

export const isEtsyConfigured = () =>
  Boolean(process.env.ETSY_KEYSTRING && process.env.ETSY_SHARED_SECRET);

const b64url = (b: Buffer) => b.toString("base64url");

export function createPkce() {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function buildAuthUrl(challenge: string, state: string) {
  const u = new URL("https://www.etsy.com/oauth/connect");
  u.search = new URLSearchParams({
    response_type: "code",
    client_id: KEY,
    redirect_uri: REDIRECT,
    scope: SCOPES.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return u.toString();
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!res.ok) throw new Error(`etsy token ${res.status}: ${await res.text()}`);
  return (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  };
}

export const exchangeCode = (code: string, verifier: string) =>
  tokenRequest({
    grant_type: "authorization_code",
    client_id: KEY,
    redirect_uri: REDIRECT,
    code,
    code_verifier: verifier,
  });

export const refreshTokens = (refreshToken: string) =>
  tokenRequest({
    grant_type: "refresh_token",
    client_id: KEY,
    refresh_token: refreshToken,
  });

export async function etsyFetch(
  path: string,
  accessToken?: string,
  init: RequestInit = {}
) {
  const headers = new Headers(init.headers);
  headers.set("x-api-key", `${KEY}:${SECRET}`);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(`${API}${path}`, { ...init, headers });
}