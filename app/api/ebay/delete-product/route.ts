import { NextRequest, NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Publication from "@/models/Publication";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import { getEbayAccountContext } from "@/libs/ebay/policies";
import {
  deleteEbayInventoryItem,
  withdrawEbayOffer,
} from "@/libs/ebay/inventory";
import { EbayApiError } from "@/libs/ebay/api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { publicationId } = await req.json();
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
    _id?: { toString(): string };
    userId?: { toString(): string };
  } | null;

  if (!account || account.userId?.toString() !== userId) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  try {
    const { accessToken } = await getEbayAccountContext(
      account._id!.toString(),
      userId
    );

    const offerId = publication.ebayOfferId;
    const sku = publication.ebaySku;

    if (offerId) {
      try {
        await withdrawEbayOffer(accessToken, offerId);
      } catch (err) {
        if (!(err instanceof EbayApiError) || err.status !== 404) {
          throw err;
        }
      }
    }

    if (sku) {
      try {
        await deleteEbayInventoryItem(accessToken, sku);
      } catch (err) {
        if (!(err instanceof EbayApiError) || err.status !== 404) {
          throw err;
        }
      }
    }

    await Publication.deleteOne({ _id: publicationId });

    return NextResponse.json({
      ok: true,
      deletedExternalId: publication.externalId,
    });
  } catch (err) {
    console.error("eBay delete error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Error al eliminar en eBay",
      },
      { status: 502 }
    );
  }
}
