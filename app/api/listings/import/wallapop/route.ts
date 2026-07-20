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
  const platform = "wallapop";
  const platformId = "2";

  await connectMongo();
  const existingPublication = await Publication.findOne({
    platformId,
    externalId: String(externalId),
  });
  if (existingPublication) return;

  let photoUrls: string[] = [];
  if (item.images?.length > 0) {
    const uploadPromises = item.images.map((image: any, index: number) => {
      const url = image?.urls?.big ?? image?.urls?.medium ?? image?.urls?.small;
      if (!url) return Promise.resolve(null);
      const key = `listings/${userId}/${externalId}_${index}.webp`;
      return uploadImageFromUrl(url, key).catch((): null => null);
    });
    const results = await Promise.all(uploadPromises);
    photoUrls = results.filter((url): url is string => url !== null);
  }

  const listing = await Listing.create({
    userId: new mongoose.Types.ObjectId(userId),
    title: item.title,
    status: "active",
    price: item.price.amount,
    photoUrl: photoUrls,
    stock: 1,
  });

  const publicationUrl = item.slug ? `https://es.wallapop.com/item/${item.slug}`: String();

  await Publication.create({
    listingId: listing._id,
    platform,
    platformId,
    externalId: String(externalId),
    price: item.price.amount,
    status: "active",
    syncStatus: "live",
    lastSync: new Date(),
    publicationUrl,
    accountId: new mongoose.Types.ObjectId(accountId),
  });
}
