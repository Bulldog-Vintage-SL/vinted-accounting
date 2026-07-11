import config from "@/config";

/**
 * Canonical app URL for server-side redirects (OAuth, Shopify, etc.).
 */
export function getAppUrl(): string {
  if (process.env.NODE_ENV === "development") {
    return (
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXTAUTH_URL ??
      "http://localhost:3000"
    );
  }

  if (process.env.AUTH_CANONICAL_URL) {
    return process.env.AUTH_CANONICAL_URL.replace(/\/$/, "");
  }

  const envUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL;
  if (envUrl && !envUrl.includes("localhost")) {
    return envUrl.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return `https://${config.domainName}`;
}

/**
 * NextAuth reads AUTH_URL / NEXTAUTH_URL from the environment.
 * Fix localhost values and align preview deployments automatically.
 */
export function ensureAuthEnv(): void {
  if (process.env.NEXTAUTH_SECRET && !process.env.AUTH_SECRET) {
    process.env.AUTH_SECRET = process.env.NEXTAUTH_SECRET;
  }

  if (process.env.NODE_ENV !== "production") return;

  if (process.env.AUTH_CANONICAL_URL) {
    const canonicalUrl = process.env.AUTH_CANONICAL_URL.replace(/\/$/, "");
    process.env.AUTH_URL = canonicalUrl;
    process.env.NEXTAUTH_URL = canonicalUrl;
    return;
  }

  const deploymentUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : null;
  const currentUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;

  // Preview deployments always use their own *.vercel.app URL
  if (process.env.VERCEL_ENV === "preview" && deploymentUrl) {
    process.env.AUTH_URL = deploymentUrl;
    process.env.NEXTAUTH_URL = deploymentUrl;
    return;
  }

  if (!currentUrl || currentUrl.includes("localhost")) {
    const productionUrl = getAppUrl();
    process.env.AUTH_URL = productionUrl;
    process.env.NEXTAUTH_URL = productionUrl;
  }
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
