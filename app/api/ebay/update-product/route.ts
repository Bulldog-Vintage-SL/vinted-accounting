import { NextRequest, NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Listing from "@/models/Listing";
import Publication from "@/models/Publication";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import {
  ensureEbayListingPolicies,
  getEbayAccountContext,
} from "@/libs/ebay/policies";
import {
  updateEbayOffer,
  upsertEbayInventoryItem,
} from "@/libs/ebay/inventory";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { publicationId, fields } = await req.json();
  if (!publicationId || !fields) {
    return NextResponse.json({ error: "faltan parámetros" }, { status: 400 });
  }

  await connectMongo();
  const publication = await Publication.findOne({
    _id: publicationId,
    platform: "ebay",
  }).populate("accountId");

  if (!publication) {
    return NextResponse.json({ error: "publicación no encontrada" }, { status: 404 });
  }

  const accountDoc = publication.accountId as {
    _id?: { toString(): string };
    userId?: { toString(): string };
  } | null;

  if (!accountDoc || accountDoc.userId?.toString() !== userId) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const listing = await Listing.findById(publication.listingId);
  if (!listing) {
    return NextResponse.json({ error: "listing no encontrado" }, { status: 404 });
  }

  try {
    const { account, accessToken } = await getEbayAccountContext(
      accountDoc._id!.toString(),
      userId
    );

    const sku = publication.ebaySku ?? listing.sku;
    const offerId = publication.ebayOfferId;

    if (!sku || !offerId) {
      return NextResponse.json(
        { error: "publicación de eBay incompleta (falta SKU u offerId)" },
        { status: 400 }
      );
    }

    listing.title = fields.title;
    listing.description = fields.description;
    listing.price = parseFloat(fields.price);
    listing.sku = fields.sku?.trim() || sku;

    const policies = await ensureEbayListingPolicies(account, accessToken);
    await upsertEbayInventoryItem(accessToken, listing, sku);
    await updateEbayOffer(accessToken, offerId, listing, sku, policies);

    await Listing.findByIdAndUpdate(listing._id, {
      title: fields.title,
      description: fields.description,
      price: parseFloat(fields.price),
      sku: fields.sku?.trim() || sku,
      lastUpdate: new Date(),
    });

    await Publication.findByIdAndUpdate(publication._id, {
      price: parseFloat(fields.price),
      lastSync: new Date(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("eBay update error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Error al actualizar en eBay",
      },
      { status: 502 }
    );
  }
}
