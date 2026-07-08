import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Listing from "@/models/Listing";
import Publication from "@/models/Publication";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
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
  const platform = "vestiaire";
  const platformId = "3";

  await connectMongo();
  const existingPublication = await Publication.findOne({
    platformId,
    externalId: String(externalId),
  });
  if (existingPublication) return;

  const photoUrls =
    item.pictures?.map((picPath: string) => {
      const filename = picPath.split("/produit/")[1];
      return `https://images.vestiairecollective.com/produit/${filename}`;
    }) ?? [];

  const price = item.price?.cents != null ? item.price.cents / 100 : null;
  const colors = item.colors?.all?.map((c: any) => c.name) ?? [];
  const gender =
    item.universeId === 1 ? "mujer" : item.universeId === 2 ? "hombre" : null;

  const listing = await Listing.create({
    userId: new mongoose.Types.ObjectId(userId),
    title: item.description ?? null,
    description: null,
    status: "active",
    price,
    photoUrl: photoUrls,
    colors,
    gender,
    itemType: item.name ?? null,
    condition: null,
    attributes: {
      brand: item.brand?.name ?? null,
      size: normalizeVestiaireSize(item.size?.label),
    },
    stock: 1,
  });

  const publicationUrl = item.link
    ? `https://es.vestiairecollective.com${item.link}`
    : null;

  await Publication.create({
    listingId: listing._id,
    platform,
    platformId: String(platformId),
    externalId: String(externalId),
    price,
    syncStatus: "live",
    lastSync: new Date(),
    accountId: new mongoose.Types.ObjectId(accountId),
    publicationUrl,
  });
}

function normalizeVestiaireSize(label: string | undefined): string | null {
  if (!label) return null;
  const match = label.match(
    /^(XS|S|M|L|XL|XXL|XXXL|4XL|5XL|6XL|7XL|8XL|Talla única)/i
  );
  return match ? match[1].toUpperCase() : null;
}
