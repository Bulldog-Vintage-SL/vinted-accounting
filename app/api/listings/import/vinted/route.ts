import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Listing from "@/models/Listing";
import Publication from "@/models/Publication";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import { uploadImageFromUrl } from "@/utils/r2/uploadImage";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

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
    console.error("Error procesando el armario: ", err);
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
  const platform = "vinted";
  const platformId = "1";

  await connectMongo();
  const existingPublication = await Publication.findOne({
    platformId,
    externalId: String(externalId),
  });

  if (existingPublication) return;

  let photoUrls: string[] = [];
  if (item.photos?.length > 0) {
    const uploadPromises = item.photos.map((photo: any, index: number) => {
      if (!photo?.url) return Promise.resolve(null);
      const key = `listings/${userId}/${externalId}_${index}.webp`;
      return uploadImageFromUrl(photo.url, key).catch((): null => null);
    });
    const results = await Promise.all(uploadPromises);
    photoUrls = results.filter((url): url is string => url !== null);
  }

  const listing = await Listing.create({
    userId: new mongoose.Types.ObjectId(userId),
    title: item.title,
    status: getVintedStatus(item),
    condition: item.status,
    price: item.price.amount,
    photoUrl: photoUrls,
    attributes: { brand: item.brand, size: item.size },
    stock: 1,
  });

  const slug = buildVintedSlug(item.title);
  const publicationUrl = `https://www.vinted.es/items/${externalId}-${slug}`;

  await Publication.create({
    listingId: listing._id,
    platform,
    platformId,
    externalId: String(externalId),
    price: item.price.amount,
    syncStatus: "live",
    lastSync: new Date(),
    publicationUrl,
    accountId: new mongoose.Types.ObjectId(accountId),
  });
}

function getVintedStatus(item: any): string {
  if (item.is_draft) return "draft";
  if (item.is_reserved) return "reserved";
  if (item.is_closed) return "closed";
  if (item.is_hidden) return "hidden";
  return "active";
}

function buildVintedSlug(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") 
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") 
    .trim()
    .replace(/\s+/g, "-") 
    .replace(/-+/g, "-"); 
}
