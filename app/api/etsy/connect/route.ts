import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import mongoose from "mongoose";
import connectMongo from "@/libs/mongoose";
import EtsyOAuthState from "@/models/EtsyOAuthState";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import { buildAuthUrl, createPkce, isEtsyConfigured } from "@/libs/etsy/client";
import { getAppUrl } from "@/libs/app-url";

export const dynamic = "force-dynamic";

function redirectWithError(reason: string) {
  const url = new URL("/settings/accounts", getAppUrl());
  url.searchParams.set("etsy", "error");
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!isEtsyConfigured()) return redirectWithError("missing_config");

  await connectMongo();

  const state = randomBytes(16).toString("hex");
  const { verifier, challenge } = createPkce();
  await EtsyOAuthState.create({
    state,
    userId: new mongoose.Types.ObjectId(userId),
    codeVerifier: verifier,
  });

  return NextResponse.redirect(buildAuthUrl(challenge, state));
}