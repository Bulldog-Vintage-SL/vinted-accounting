import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/libs/supabase/admin";

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

  const supabase = createAdminClient();

  const { data: stateRow } = await supabase
    .from("shopify_oauth_states")
    .select("*")
    .eq("state", state)
    .eq("shop", shop)
    .single();

  if (!stateRow) {
    return redirectWithError("invalid_state");
  }

  const isExpired =
    new Date().getTime() - new Date(stateRow.created_at).getTime() >
    10 * 60 * 1000;
  if (isExpired) {
    await supabase.from("shopify_oauth_states").delete().eq("state", state);
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

  const { error: upsertError } = await supabase.from("accounts").upsert(
    {
      profile_id: stateRow.profile_id,
      platform: "shopify",
      shopify_shop_domain: shop,
      shopify_access_token: access_token,
      shopify_scopes: scope,
      account_name: shop,
      sync_status: "connected",
      last_sync: new Date().toISOString(),
    },
    { onConflict: "shopify_shop_domain" }
  );

  if (upsertError) {
    return redirectWithError("save_failed");
  }

  await supabase.from("shopify_oauth_states").delete().eq("state", state);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL;
  const successUrl = new URL(ACCOUNTS_PAGE, appUrl);
  successUrl.searchParams.set("shopify", "connected");
  return NextResponse.redirect(successUrl);
}
