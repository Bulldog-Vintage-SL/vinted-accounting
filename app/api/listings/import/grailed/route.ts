import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Listing from "@/models/Listing";
import Publication from "@/models/Publication";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import { uploadImageFromUrl } from "@/utils/r2/uploadImage";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

const GRAILED_CONDITION: Record<string, string> = {
  is_new: "Nuevo",
  is_gently_used: "Como nuevo",
  is_used: "Aceptable",
  is_worn: "Aceptable",
  is_not_specified: "Bueno",
};

function toListingPrice(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "object") {
    const obj = raw as any;
    if (obj.amount != null) return toListingPrice(obj.amount);
    if (obj.cents != null) return Number(obj.cents) / 100;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (Number.isInteger(n) && n >= 100) return n / 100;
  return n;
}

function photoUrlsFromItem(item: any): string[] {
  const photos = [
    item.coverPhoto,
    ...(Array.isArray(item.photos) ? item.photos.map((p: any) => p?.url ?? p) : []),
  ].filter(Boolean);
  return [...new Set(photos.map((url: string) => String(url)))];
}

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { status: "error", message: "Usuario no autenticado" },
        { status: 401 }
      );
    }

    const body = await req.json();
    if (!body.wardrobe || !Array.isArray(body.wardrobe)) {
      return NextResponse.json(
        { status: "error", message: "Error al importar el armario" },
        { status: 400 }
      );
    }

    for (const item of body.wardrobe) {
      await importPublication(item, userId, body.accountId);
    }

    return NextResponse.json(
      { status: "success", message: "Armario importado correctamente" },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error procesando el armario de Grailed: ", err);
    return NextResponse.json(
      {
        status: "error",
        message: err instanceof Error ? err.message : "Error desconocido",
      },
      { status: 400 }
    );
  }
}

async function importPublication(
  item: any,
  userId: string,
  accountId: string
) {
  const externalId = item.id;
  if (externalId == null) return;

  const platform = "grailed";
  const platformId = "5";

  await connectMongo();
  const existingPublication = await Publication.findOne({
    platformId,
    externalId: String(externalId),
  });
  if (existingPublication) return;

  const sourcePhotos = photoUrlsFromItem(item);
  const uploaded = await Promise.all(
    sourcePhotos.map((url, index) => {
      const key = `listings/${userId}/${externalId}_${index}.webp`;
      return uploadImageFromUrl(url, key).catch((): null => null);
    })
  );
  const photoUrls = uploaded.filter((url): url is string => url !== null);

  const price = toListingPrice(item.price);
  const brand = item.designers?.[0]?.name ?? null;
  const condition = GRAILED_CONDITION[item.condition] ?? null;
  const slug = item.slug ? String(item.slug).replace(/^\//, "") : "";
  const publicationUrl = slug
    ? `https://www.grailed.com/${slug}`
    : `https://www.grailed.com/listings/${externalId}`;

  const listing = await Listing.create({
    userId: new mongoose.Types.ObjectId(userId),
    title: item.title ?? "Artículo Grailed",
    description: item.description || null,
    status: item.sold ? "closed" : "active",
    condition,
    price,
    photoUrl: photoUrls,
    attributes: {
      brand,
      size: item.size ?? null,
    },
    stock: 1,
  });

  await Publication.create({
    listingId: listing._id,
    platform,
    platformId,
    externalId: String(externalId),
    price,
    status: item.sold ? "closed" : "active",
    syncStatus: "live",
    lastSync: new Date(),
    publicationUrl,
    accountId: new mongoose.Types.ObjectId(accountId),
  });
}
