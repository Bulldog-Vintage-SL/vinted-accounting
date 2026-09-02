import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Listing from "@/models/Listing";
import Publication from "@/models/Publication";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import {
  listingFormToMongo,
  serializeListing,
} from "@/libs/listings/serialize";
import { validateListingCreationFields } from "@/libs/listings/validation";
import { sortPlatforms } from "@/libs/inventory/display";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    await connectMongo();
    const listings = await Listing.find({ userId }).sort({ createdAt: -1 });
    const listingIds = listings.map((listing) => listing._id);
    const publications =
      listingIds.length > 0
        ? await Publication.find({ listingId: { $in: listingIds } }).select(
            "listingId platform"
          )
        : [];

    const platformsByListing = new Map<string, string[]>();
    for (const publication of publications) {
      const listingId = publication.listingId.toString();
      const current = platformsByListing.get(listingId) ?? [];
      current.push(publication.platform);
      platformsByListing.set(listingId, current);
    }

    return NextResponse.json(
      listings.map((listing) =>
        serializeListing(listing, {
          platforms: sortPlatforms(
            platformsByListing.get(listing._id?.toString() ?? "") ?? []
          ),
        })
      )
    );
  } catch (err) {
    console.error("Error obteniendo listings:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 400 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json();

    const validationError = validateListingCreationFields(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    await connectMongo();
    const listing = await Listing.create({
      userId: new mongoose.Types.ObjectId(userId),
      ...listingFormToMongo(body),
      status: "active",
    });

    return NextResponse.json(serializeListing(listing), { status: 201 });
  } catch (err) {
    console.error("Error creando listing:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 400 }
    );
  }
}
