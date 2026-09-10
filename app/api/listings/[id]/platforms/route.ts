import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Listing from "@/models/Listing";
import Publication from "@/models/Publication";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import { serializeListing } from "@/libs/listings/serialize";
import {
  isKnownPlatform,
  sortPlatforms,
} from "@/libs/inventory/display";

export const dynamic = "force-dynamic";

function parseRequestedPlatforms(body: unknown): string[] | null {
  if (!body || typeof body !== "object") return null;

  const platforms = (body as { platforms?: unknown }).platforms;
  if (!Array.isArray(platforms)) return null;

  return sortPlatforms(
    platforms
      .filter((platform): platform is string => typeof platform === "string")
      .map((platform) => platform.trim().toLowerCase())
      .filter(isKnownPlatform)
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const requestedPlatforms = parseRequestedPlatforms(await req.json());
    if (!requestedPlatforms) {
      return NextResponse.json(
        { error: "Debes indicar las plataformas a marcar" },
        { status: 400 }
      );
    }

    await connectMongo();
    const listing = await Listing.findOne({ _id: id, userId });
    if (!listing) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const publications = await Publication.find({ listingId: listing._id }).select(
      "platform"
    );
    const publishedPlatforms = sortPlatforms(
      publications.map((publication) => publication.platform)
    );
    const publishedSet = new Set(publishedPlatforms);
    const manualPlatforms = requestedPlatforms.filter(
      (platform) => !publishedSet.has(platform)
    );

    await Listing.collection.updateOne(
      { _id: listing._id },
      { $set: { manualPlatforms, lastUpdate: new Date() } }
    );

    const updated = await Listing.findOne({ _id: listing._id, userId });

    return NextResponse.json(
      serializeListing(updated ?? listing, {
        publishedPlatforms,
        manualPlatforms,
      })
    );
  } catch (err) {
    console.error("Error actualizando plataformas del listing:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 400 }
    );
  }
}
