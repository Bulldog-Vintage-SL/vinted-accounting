import { NextRequest, NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Listing from "@/models/Listing";
import Publication from "@/models/Publication";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import {
  ensureEbayListingPolicies,
  getEbayAccountContext,
  isInvalidEbayPolicyError,
  EbayPoliciesPermissionError,
} from "@/libs/ebay/policies";
import { publishListingToEbay } from "@/libs/ebay/inventory";
import { buildEbayListingUrl } from "@/libs/ebay/mappers";
import { getEbayMarketplaceId } from "@/libs/ebay/client";
import { EbayApiError } from "@/libs/ebay/api";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function validateListingForEbay(listing: {
  title?: string | null;
  description?: string | null;
  price?: number | null;
  photoUrl?: string[];
}) {
  const missing: string[] = [];
  if (!listing.title?.trim()) missing.push("título");
  if (!listing.description?.trim()) missing.push("descripción");
  if (!listing.price || listing.price <= 0) missing.push("precio");
  if (!listing.photoUrl?.length) missing.push("foto");
  return missing;
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { listingId, accountId } = await req.json();
  if (!listingId || !accountId) {
    return NextResponse.json({ error: "faltan parámetros" }, { status: 400 });
  }

  await connectMongo();

  const listing = await Listing.findOne({ _id: listingId, userId });
  if (!listing) {
    return NextResponse.json({ error: "listing no encontrado" }, { status: 404 });
  }

  const missing = validateListingForEbay(listing);
  if (missing.length) {
    return NextResponse.json(
      { error: `Faltan campos obligatorios: ${missing.join(", ")}` },
      { status: 422 }
    );
  }

  let accessToken: string;
  let account: Awaited<ReturnType<typeof getEbayAccountContext>>["account"];

  try {
    const ctx = await getEbayAccountContext(accountId, userId);
    accessToken = ctx.accessToken;
    account = ctx.account;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "cuenta no encontrada" },
      { status: 404 }
    );
  }

  try {
    let policies = await ensureEbayListingPolicies(account, accessToken);

    let publishResult;
    try {
      publishResult = await publishListingToEbay(accessToken, listing, policies);
    } catch (err) {
      // IDs de políticas cacheados / política de envío sin servicio válido
      // (25007): se recrean y se reintenta una vez.
      if (!isInvalidEbayPolicyError(err)) throw err;
      const forceNewFulfillment =
        err instanceof EbayApiError &&
        (/"errorId":25007/.test(err.body) ||
          /valid shipping service/i.test(err.body));
      policies = await ensureEbayListingPolicies(account, accessToken, {
        skipCache: true,
        forceNewFulfillment,
      });
      publishResult = await publishListingToEbay(accessToken, listing, policies);
    }

    const { sku, offerId, listingId: ebayListingId } = publishResult;

    const marketplaceId = policies.marketplaceId || getEbayMarketplaceId();
    const publicationUrl = buildEbayListingUrl(ebayListingId, marketplaceId);

    const existingPub = await Publication.findOne({
      accountId: account._id,
      platform: "ebay",
      listingId: listing._id,
    });

    let publication;
    if (existingPub) {
      publication = await Publication.findByIdAndUpdate(
        existingPub._id,
        {
          externalId: ebayListingId,
          ebayOfferId: offerId,
          ebaySku: sku,
          price: listing.price,
          status: "active",
          publicationUrl,
          syncStatus: "OK",
          lastSync: new Date(),
        },
        { new: true }
      );
    } else {
      publication = await Publication.create({
        listingId: listing._id,
        accountId: account._id,
        platform: "ebay",
        platformId: marketplaceId,
        externalId: ebayListingId,
        ebayOfferId: offerId,
        ebaySku: sku,
        price: listing.price,
        status: "active",
        publicationUrl,
        syncStatus: "OK",
        lastSync: new Date(),
      });
    }

    await Listing.findByIdAndUpdate(listing._id, {
      sku,
      lastUpdate: new Date(),
    });

    return NextResponse.json({ ok: true, publication });
  } catch (err) {
    console.error("eBay upload error:", err);

    if (
      err instanceof EbayPoliciesPermissionError ||
      (err instanceof EbayApiError && err.status === 403)
    ) {
      const message =
        err instanceof EbayPoliciesPermissionError
          ? err.message
          : new EbayPoliciesPermissionError().message;
      return NextResponse.json({ error: message }, { status: 403 });
    }

    const message =
      err instanceof Error ? err.message : "Error desconocido al publicar en eBay";
    const details =
      err && typeof err === "object" && "body" in err
        ? String((err as { body: string }).body)
        : undefined;

    return NextResponse.json(
      { error: details ? `${message}: ${details}` : message },
      { status: 502 }
    );
  }
}
