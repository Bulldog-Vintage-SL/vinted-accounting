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
} from "@/libs/ebay/client";

export const dynamic = "force-dynamic";

const ACCOUNTS_PAGE = "/settings/accounts";

function redirectWithError(reason: string) {
  const url = new URL(ACCOUNTS_PAGE, getAppUrl());
  url.searchParams.set("ebay", "error");
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");
  const errorDescription = params.get("error_description");

  if (error) {
    return redirectWithError(errorDescription || error);
  }

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
    return redirectWithError("token_exchange_failed");
  }
}
