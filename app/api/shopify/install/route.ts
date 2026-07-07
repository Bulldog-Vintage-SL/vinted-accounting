import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createAdminClient } from "@/libs/supabase/admin";
import { getAuthenticatedProfileId } from "@/libs/accounts/get-profile-id";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop");
  if (!shop || !/^[a-zA-Z0-9-]+\.myshopify\.com$/.test(shop)) {
    return NextResponse.json({ error: "shop inválido" }, { status: 400 });
  }

  const profileId = await getAuthenticatedProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("accounts")
    .select("id, profile_id")
    .eq("shopify_shop_domain", shop)
    .maybeSingle();

  if (existing && existing.profile_id !== profileId) {
    return NextResponse.json(
      { error: "esta tienda ya está conectada a otra cuenta" },
      { status: 409 }
    );
  }

  const state = randomBytes(16).toString("hex");

  await supabase.from("shopify_oauth_states").insert({
    state,
    profile_id: profileId,
    shop,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL;
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
