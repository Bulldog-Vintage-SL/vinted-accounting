import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import mongoose from "mongoose";
import connectMongo from "@/libs/mongoose";
import EbayOAuthState from "@/models/EbayOAuthState";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import { buildEbayAuthorizeUrl, isEbayOAuthConfigured } from "@/libs/ebay/client";
import { getAppUrl } from "@/libs/app-url";

export const dynamic = "force-dynamic";

const ACCOUNTS_PAGE = "/settings/accounts";

function redirectWithError(reason: string) {
  const url = new URL(ACCOUNTS_PAGE, getAppUrl());
  url.searchParams.set("ebay", "error");
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) {
    return redirectWithError("missing_config");
  }

  if (!isEbayOAuthConfigured()) {
    return redirectWithError("missing_runame");
  }

  await connectMongo();

  const state = randomBytes(16).toString("hex");
  await EbayOAuthState.create({
    state,
    userId: new mongoose.Types.ObjectId(userId),
  });

  return NextResponse.redirect(buildEbayAuthorizeUrl(state));
}
