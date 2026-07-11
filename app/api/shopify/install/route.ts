import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import connectMongo from "@/libs/mongoose";
import Account from "@/models/Account";
import ShopifyOAuthState from "@/models/ShopifyOAuthState";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import { getAppUrl } from "@/libs/app-url";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop");
  if (!shop || !/^[a-zA-Z0-9-]+\.myshopify\.com$/.test(shop)) {
    return NextResponse.json({ error: "shop inválido" }, { status: 400 });
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  await connectMongo();
  const existing = await Account.findOne({ shopifyShopDomain: shop });

  if (existing && existing.userId.toString() !== userId) {
    return NextResponse.json(
      { error: "esta tienda ya está conectada a otra cuenta" },
      { status: 409 }
    );
  }

  const state = randomBytes(16).toString("hex");
  await ShopifyOAuthState.create({
    state,
    userId: new mongoose.Types.ObjectId(userId),
    shop,
  });

  const appUrl = getAppUrl();
  const params = new URLSearchParams({
    client_id: process.env.SHOPIFY_CLIENT_ID!,
    scope: "read_products,write_products",
    redirect_uri: `${appUrl}/api/shopify/callback`,
    state,
  });

  return NextResponse.redirect(
    `https://${shop}/admin/oauth/authorize?${params.toString()}`
  );
}
