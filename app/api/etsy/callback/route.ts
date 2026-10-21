import { NextRequest, NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Account from "@/models/Account";
import EtsyOAuthState from "@/models/EtsyOAuthState";
import { exchangeCode, etsyFetch, SCOPES } from "@/libs/etsy/client";
import { encrypt } from "@/libs/etsy/crypto";
import { getAppUrl } from "@/libs/app-url";

export const dynamic = "force-dynamic";

function redirectTo(params: Record<string, string>) {
  const url = new URL("/settings/accounts", getAppUrl());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const oauthError = p.get("error");
  if (oauthError) return redirectTo({ etsy: "error", reason: oauthError });

  const code = p.get("code");
  const state = p.get("state");
  if (!code || !state) return redirectTo({ etsy: "error", reason: "missing_params" });

  await connectMongo();
  const saved = await EtsyOAuthState.findOneAndDelete({ state });
  if (!saved) return redirectTo({ etsy: "error", reason: "invalid_state" });

  try {
    const t = await exchangeCode(code, saved.codeVerifier);

    const meRes = await etsyFetch("/v3/application/users/me", t.access_token);
    if (meRes.status === 404) return redirectTo({ etsy: "error", reason: "no_shop" });
    if (!meRes.ok) {
      console.error("[etsy] users/me failed:", meRes.status, await meRes.text());
      return redirectTo({ etsy: "error", reason: "me_failed" });
    }

    const me = await meRes.json();
    if (!me.shop_id) return redirectTo({ etsy: "error", reason: "no_shop" });

    const shopRes = await etsyFetch(
      `/v3/application/shops/${me.shop_id}`,
      t.access_token
    );
    const shop = shopRes.ok ? await shopRes.json() : null;

    await Account.findOneAndUpdate(
      { userId: saved.userId, platform: "etsy", externalId: String(me.shop_id) },
      {
        $set: {
          syncStatus: "OK",
          lastSync: new Date(),
          accountName: shop?.shop_name ?? null,
          profileLink: shop?.url ?? null,
          etsyUserId: me.user_id,
          etsyAccessToken: encrypt(t.access_token),
          etsyRefreshToken: encrypt(t.refresh_token),
          etsyTokenExpiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000),
          etsyScopes: SCOPES.join(" "),
        },
      },
      { upsert: true, new: true }
    );

    return redirectTo({ etsy: "connected" });
  } catch {
    return redirectTo({ etsy: "error", reason: "exchange_failed" });
  }
}