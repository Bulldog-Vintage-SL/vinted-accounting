import { NextRequest, NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Account from "@/models/Account";
import EbayOAuthState from "@/models/EbayOAuthState";
import { getAppUrl } from "@/libs/app-url";
import {
  buildEbayProfileUrl,
  exchangeEbayAuthorizationCode,
  getEbayTokenExpiryDate,
  getEbayUserIdentity,
  normalizeEbayAuthorizationCode,
  EbayOAuthError,
} from "@/libs/ebay/client";

export const dynamic = "force-dynamic";

const ACCOUNTS_PAGE = "/settings/accounts";

function redirectWithError(reason: string, details?: string) {
  const url = new URL(ACCOUNTS_PAGE, getAppUrl());
  url.searchParams.set("ebay", "error");
  url.searchParams.set("reason", reason);
  if (details) {
    url.searchParams.set("details", details.slice(0, 300));
  }
  return NextResponse.redirect(url);
}

/**
 * eBay auth codes contain `#` which breaks URL parsing if not encoded.
 * Fall back to parsing the raw query string when the code looks truncated.
 */
function getAuthorizationCode(req: NextRequest): string | null {
  const params = req.nextUrl.searchParams;
  const fromParams = params.get("code");
  if (fromParams) {
    const normalized = normalizeEbayAuthorizationCode(fromParams);
    if (normalized.length > 20) return normalized;
  }

  const queryString = req.nextUrl.search.slice(1);
  const stateIndex = queryString.indexOf("&state=");
  const codePrefix = "code=";
  const codeStart = queryString.indexOf(codePrefix);
  if (codeStart === -1) return fromParams;

  const valueStart = codeStart + codePrefix.length;
  const valueEnd = stateIndex > codeStart ? stateIndex : queryString.length;
  const rawCode = queryString.slice(valueStart, valueEnd);

  return normalizeEbayAuthorizationCode(rawCode);
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const state = params.get("state");
  const error = params.get("error");
  const errorDescription = params.get("error_description");

  if (error) {
    const reason = error === "access_denied" ? "access_denied" : "ebay_error";
    return redirectWithError(reason, errorDescription || error);
  }

  const code = getAuthorizationCode(req);

  if (!code || !state) {
    return redirectWithError("missing_params");
  }

  await connectMongo();
  const stateRow = await EbayOAuthState.findOne({ state });

  if (!stateRow) {
    return redirectWithError("invalid_state");
  }

  const isExpired =
    Date.now() - new Date(stateRow.createdAt!).getTime() > 10 * 60 * 1000;
  if (isExpired) {
    await EbayOAuthState.deleteOne({ state });
    return redirectWithError("expired_state");
  }

  try {
    const tokens = await exchangeEbayAuthorizationCode(code);
    const identity = await getEbayUserIdentity(tokens.access_token);

    const existing = await Account.findOne({
      platform: "ebay",
      externalId: identity.userId,
    });

    if (existing && existing.userId.toString() !== stateRow.userId.toString()) {
      await EbayOAuthState.deleteOne({ state });
      return redirectWithError("account_already_linked");
    }

    const profileLink = buildEbayProfileUrl(
      identity.username,
      identity.registrationMarketplaceId
    );

    await Account.findOneAndUpdate(
      {
        userId: stateRow.userId,
        platform: "ebay",
        externalId: identity.userId,
      },
      {
        userId: stateRow.userId,
        platform: "ebay",
        externalId: identity.userId,
        accountName: identity.username,
        profileLink,
        ebayAccessToken: tokens.access_token,
        ebayRefreshToken: tokens.refresh_token ?? null,
        ebayTokenExpiresAt: getEbayTokenExpiryDate(tokens.expires_in),
        ebayScopes: "sell.inventory sell.fulfillment commerce.identity.readonly",
        syncStatus: "connected",
        lastSync: new Date(),
      },
      { upsert: true, new: true }
    );

    await EbayOAuthState.deleteOne({ state });

    const successUrl = new URL(ACCOUNTS_PAGE, getAppUrl());
    successUrl.searchParams.set("ebay", "connected");
    return NextResponse.redirect(successUrl);
  } catch (err) {
    console.error("eBay OAuth callback error:", err);

    await EbayOAuthState.deleteOne({ state });

    if (err instanceof EbayOAuthError) {
      const details = err.details ?? err.message;
      const isInvalidGrant = details.includes("invalid_grant");
      const isInvalidClient = details.includes("invalid_client");

      if (isInvalidClient) {
        return redirectWithError(
          "invalid_client",
          "Revisa EBAY_CLIENT_ID y EBAY_CLIENT_SECRET en Vercel."
        );
      }

      if (isInvalidGrant) {
        return redirectWithError(
          "invalid_grant",
          "Código expirado o RuName incorrecto. Intenta conectar de nuevo."
        );
      }

      return redirectWithError("token_exchange_failed", details);
    }

    return redirectWithError("token_exchange_failed");
  }
}
