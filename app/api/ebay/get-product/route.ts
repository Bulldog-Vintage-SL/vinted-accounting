import { NextRequest, NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Listing from "@/models/Listing";
import Publication from "@/models/Publication";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const publicationId = req.nextUrl.searchParams.get("publicationId");
  if (!publicationId) {
    return NextResponse.json({ error: "falta publicationId" }, { status: 400 });
  }

  await connectMongo();
  const publication = await Publication.findOne({
    _id: publicationId,
    platform: "ebay",
  }).populate("accountId");

  if (!publication) {
    return NextResponse.json({ error: "publicación no encontrada" }, { status: 404 });
  }

  const account = publication.accountId as {
    userId?: { toString(): string };
  } | null;

  if (!account || account.userId?.toString() !== userId) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const listing = await Listing.findById(publication.listingId);
  if (!listing) {
    return NextResponse.json({ error: "listing no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    product: {
      title: listing.title ?? "",
      description: listing.description ?? "",
      price: String(publication.price ?? listing.price ?? ""),
      sku: publication.ebaySku ?? listing.sku ?? "",
      status: publication.status ?? "active",
    },
  });
}
