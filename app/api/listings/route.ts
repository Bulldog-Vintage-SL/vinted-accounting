import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Listing from "@/models/Listing";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import {
  listingFormToMongo,
  serializeListing,
} from "@/libs/listings/serialize";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    await connectMongo();
    const data = await Listing.find({ userId }).sort({ createdAt: -1 });
    return NextResponse.json(data.map(serializeListing));
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
