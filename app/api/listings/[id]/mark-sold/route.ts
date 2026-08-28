import { NextRequest, NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Listing from "@/models/Listing";
import Publication from "@/models/Publication";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import { serializeListing } from "@/libs/listings/serialize";
import {
  markListingAsSold,
  MarkSoldError,
} from "@/libs/sales/mark-sold";

export const dynamic = "force-dynamic";

function serializeSale(sale: {
  toJSON?: () => Record<string, unknown>;
  _id?: { toString(): string };
}) {
  const raw = typeof sale.toJSON === "function" ? sale.toJSON() : sale;
  return {
    ...raw,
    id: (raw as { id?: string }).id ?? sale._id?.toString(),
    listingId:
      (raw as { listingId?: { toString(): string } | string }).listingId?.toString?.() ??
      (raw as { listingId?: string }).listingId ??
      null,
    publicationId:
      (raw as { publicationId?: { toString(): string } | string }).publicationId?.toString?.() ??
      (raw as { publicationId?: string }).publicationId ??
      null,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    await connectMongo();
    const listing = await Listing.findOne({ _id: id, userId });
    if (!listing) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const publications = await Publication.find({ listingId: listing._id }).sort({
      createdAt: -1,
    });

    return NextResponse.json({
      listing: serializeListing(listing),
      publications: publications.map((p) => ({
        id: p._id?.toString() ?? "",
        platform: p.platform,
        status: p.status ?? "active",
        price: p.price ?? listing.price ?? 0,
      })),
      alreadySold: listing.status === "sold",
    });
  } catch (err) {
    console.error("Error obteniendo contexto de venta:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 400 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const salePrice =
      body.salePrice === "" || body.salePrice === undefined
        ? undefined
        : Number(body.salePrice);
    const purchasePrice =
      body.purchasePrice === "" || body.purchasePrice === undefined
        ? undefined
        : Number(body.purchasePrice);

    if (salePrice !== undefined && (Number.isNaN(salePrice) || salePrice < 0)) {
      return NextResponse.json(
        { error: "El precio de venta no puede ser negativo" },
        { status: 400 }
      );
    }

    if (
      purchasePrice !== undefined &&
      (Number.isNaN(purchasePrice) || purchasePrice < 0)
    ) {
      return NextResponse.json(
        { error: "El precio de coste no puede ser negativo" },
        { status: 400 }
      );
    }

    await connectMongo();

    const result = await markListingAsSold({
      userId,
      listingId: id,
      publicationId: body.publicationId || null,
      platform: body.platform || null,
      salePrice,
      saleDate: body.saleDate || null,
      purchasePrice,
    });

    return NextResponse.json({
      ok: true,
      sale: serializeSale(result.sale),
      listing: result.listing ? serializeListing(result.listing) : null,
      closedPublications: result.closedPublications,
      platform: result.platform,
    });
  } catch (err) {
    if (err instanceof MarkSoldError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error marcando listing como vendido:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al registrar la venta" },
      { status: 500 }
    );
  }
}
