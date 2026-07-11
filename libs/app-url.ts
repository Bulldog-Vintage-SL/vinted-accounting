import config from "@/config";

/**
 * Canonical app URL for server-side redirects (OAuth, Shopify, etc.).
 * In production, never trust localhost values copied from .env.local.
 */
export function getAppUrl(): string {
  if (process.env.NODE_ENV === "development") {
    return (
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXTAUTH_URL ??
      "http://localhost:3000"
    );
  }

  const envUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL;
  if (envUrl && !envUrl.includes("localhost")) {
    return envUrl.replace(/\/$/, "");
  }

  if (process.env.VERCEL_ENV === "production") {
    return `https://${config.domainName}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return `https://${config.domainName}`;
}

/**
 * NextAuth reads AUTH_URL / NEXTAUTH_URL from the environment.
 * Override localhost values that were accidentally set in Vercel production.
 */
export function ensureAuthEnv(): void {
  if (process.env.NEXTAUTH_SECRET && !process.env.AUTH_SECRET) {
    process.env.AUTH_SECRET = process.env.NEXTAUTH_SECRET;
  }

  if (process.env.NODE_ENV !== "production") return;

  const currentUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (currentUrl && !currentUrl.includes("localhost")) return;

  const productionUrl = getAppUrl();
  process.env.AUTH_URL = productionUrl;
  process.env.NEXTAUTH_URL = productionUrl;
}

/** @deprecated Use ensureAuthEnv */
export const ensureAuthUrl = ensureAuthEnv;

export function getLoginUrl(callbackUrl?: string): string {
  const target = callbackUrl ?? config.auth.callbackUrl;
  return `/login?callbackUrl=${encodeURIComponent(target)}`;
}

export function getGoogleLoginUrl(callbackUrl?: string): string {
  const target = callbackUrl ?? config.auth.callbackUrl;
  return `/api/auth/login/google?callbackUrl=${encodeURIComponent(target)}`;
}
