import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import connectMongo from "@/libs/mongoose";
import Account from "@/models/Account";
import ShopifyOAuthState from "@/models/ShopifyOAuthState";

export const dynamic = "force-dynamic";

const ACCOUNTS_PAGE = "/settings/accounts";

function verifyHmac(searchParams: URLSearchParams, secret: string) {
  const hmac = searchParams.get("hmac");
  if (!hmac) return false;

  const params = new URLSearchParams(searchParams);
  params.delete("hmac");
  params.delete("signature");

  const message = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const generated = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");

  if (generated.length !== hmac.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(generated, "utf8"),
    Buffer.from(hmac, "utf8")
  );
}

function redirectWithError(reason: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL;
  const url = new URL(ACCOUNTS_PAGE, appUrl);
  url.searchParams.set("shopify", "error");
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const shop = params.get("shop");
  const code = params.get("code");
  const state = params.get("state");

  if (!shop || !code || !state) {
    return redirectWithError("missing_params");
  }

  if (!verifyHmac(params, process.env.SHOPIFY_CLIENT_SECRET!)) {
    return redirectWithError("invalid_hmac");
  }

  await connectMongo();
  const stateRow = await ShopifyOAuthState.findOne({ state, shop });

  if (!stateRow) {
    return redirectWithError("invalid_state");
  }

  const isExpired =
    Date.now() - new Date(stateRow.createdAt!).getTime() > 10 * 60 * 1000;
  if (isExpired) {
    await ShopifyOAuthState.deleteOne({ state });
    return redirectWithError("expired_state");
  }

  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      code,
    }),
  });

  if (!tokenRes.ok) {
    return redirectWithError("token_exchange_failed");
  }

  const { access_token, scope } = await tokenRes.json();

  await Account.findOneAndUpdate(
    { shopifyShopDomain: shop },
    {
      userId: stateRow.userId,
      platform: "shopify",
      externalId: shop,
      shopifyShopDomain: shop,
      shopifyAccessToken: access_token,
      shopifyScopes: scope,
      accountName: shop,
      syncStatus: "connected",
      lastSync: new Date(),
    },
    { upsert: true, new: true }
  );

  await ShopifyOAuthState.deleteOne({ state });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL;
  const successUrl = new URL(ACCOUNTS_PAGE, appUrl);
  successUrl.searchParams.set("shopify", "connected");
  return NextResponse.redirect(successUrl);
}
