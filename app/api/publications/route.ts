import connectMongo from "@/libs/mongoose";
import Listing from "@/models/Listing";
import Publication from "@/models/Publication";
import Account from "@/models/Account";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import { serializePublication } from "@/libs/listings/serialize";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return Response.json(
        { status: "error", message: "No autenticado" },
        { status: 401 }
      );
    }

    await connectMongo();
    const listings = await Listing.find({ userId }).select("_id");
    const listingIds = listings.map((l) => l._id);

    const data = await Publication.find({ listingId: { $in: listingIds } })
      .populate("listingId", "title photoUrl userId")
      .sort({ createdAt: -1 });

    return Response.json({
      status: "success",
      data: data.map(serializePublication),
    });
  } catch (err) {
    console.error("Error obteniendo publications:", err);
    return Response.json(
      {
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 400 }
    );
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const { externalId, listingId, platform, publicationUrl, accountId } = body;

  if (!externalId || !listingId || !platform || !publicationUrl || !accountId) {
    return Response.json(
      { status: "error", message: "Falta algún parámetro" },
      { status: 400 }
    );
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return Response.json(
      { status: "error", message: "No autenticado" },
      { status: 401 }
    );
  }

  await connectMongo();
  const listing = await Listing.findOne({ _id: listingId, userId });
  if (!listing) {
    return Response.json(
      { status: "error", message: "Producto no encontrado" },
      { status: 404 }
    );
  }

  const account = await Account.findOne({ _id: accountId, userId });
  if (!account) {
    return Response.json(
      { status: "error", message: "Cuenta no encontrada" },
      { status: 404 }
    );
  }

  const publication = await Publication.findOneAndUpdate(
    { platform, externalId: String(externalId) },
    {
      listingId: new mongoose.Types.ObjectId(listingId),
      platform,
      platformId: String(externalId),
      externalId: String(externalId),
      price: listing.price,
      syncStatus: "synced",
      lastSync: new Date(),
      publicationUrl,
      accountId: new mongoose.Types.ObjectId(accountId),
    },
    { upsert: true, new: true }
  );

  return Response.json({
    status: "success",
    message: "Publicación registrada con éxito",
    data: publication,
  });
}

export async function DELETE(req: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });

    await connectMongo();
    const publication = await Publication.findById(id).populate("listingId");
    if (
      !publication ||
      (publication.listingId as any)?.userId?.toString() !== userId
    ) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    await Publication.deleteOne({ _id: id });
    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return Response.json(
        { status: "error", message: "No autenticado" },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return Response.json(
        { status: "error", message: "Falta el id" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { price } = body;
    if (price === undefined) {
      return Response.json(
        { status: "error", message: "No se ha enviado ningún campo a actualizar" },
        { status: 400 }
      );
    }

    const priceNumber = Number(price);
    if (Number.isNaN(priceNumber) || priceNumber <= 0) {
      return Response.json(
        { status: "error", message: "Precio inválido" },
        { status: 400 }
      );
    }

    await connectMongo();
    const publication = await Publication.findById(id).populate("listingId");
    if (
      !publication ||
      (publication.listingId as any)?.userId?.toString() !== userId
    ) {
      return Response.json(
        { status: "error", message: "Publicación no encontrada" },
        { status: 404 }
      );
    }

    publication.price = priceNumber;
    await publication.save();

    return Response.json({
      status: "success",
      message: "Publicación actualizada con éxito",
      data: publication,
    });
  } catch (err) {
    console.error("Error actualizando publication:", err);
    return Response.json(
      {
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 400 }
    );
  }
}
