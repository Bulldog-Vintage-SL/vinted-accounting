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
  const platform = "depop";
  const platformId = "4";

  await connectMongo();
  const existingPublication = await Publication.findOne({
    platformId,
    externalId: String(externalId),
  });

  if (existingPublication) return;

  let photoUrls: string[] = [];
  if (item.pictures?.length > 0) {
    const uploadPromises = item.pictures.map((pic: any, index: number) => {
      const bestUrl = pic?.["1280"] ?? pic?.["960"] ?? pic?.["640"];
      if (!bestUrl) return Promise.resolve(null);
      const key = `listings/${userId}/${externalId}_${index}.webp`;
      return uploadImageFromUrl(bestUrl, key).catch((): null => null);
    });
    const results = await Promise.all(uploadPromises);
    photoUrls = results.filter((url): url is string => url !== null);
  }

  const price = item.pricing?.original_price?.total_price;

  const listing = await Listing.create({
    userId: new mongoose.Types.ObjectId(userId),
    title: item.description,
    status: getDepopStatus(item),
    condition: null,
    price: price != null ? Number(price) : 0,
    photoUrl: photoUrls,
    attributes: {size: mapSizeToStandard(item.sizes?.[0]) },
    stock: 1,
  });

  const publicationUrl = `https://www.depop.com/products/${item.slug}/`;

  await Publication.create({
    listingId: listing._id,
    platform,
    platformId,
    externalId: String(externalId),
    price: price != null ? Number(price) : 0,
    status: getDepopStatus(item),
    syncStatus: "live",
    lastSync: new Date(),
    publicationUrl,
    accountId: new mongoose.Types.ObjectId(accountId),
  });
}

function getDepopStatus(item: any): string {
  if (item.sold) return "closed";
  if (item.status === "SOLD_OUT") return "closed";
  if (item.status !== "ONSALE") return "hidden";
  return "active";
}

function mapSizeToStandard(sizeInput: string): string | null {
  const allowed = new Set([
    "XS", "S", "M", "L", "XL", "XXL", "XXXL",
    "4XL", "5XL", "6XL", "7XL", "8XL", "Talla única"
  ]);

  const normalized = sizeInput?.trim() ?? "";
  if (!normalized) return null;

  const lower = normalized.toLowerCase();

  const synonymMap: Record<string, string> = {
    "extra small": "XS",
    "small": "S",
    "medium": "M",
    "large": "L",
    "extra large": "XL",
    "extra extra large": "XXL",
    "extra extra extra large": "XXXL",
    "one size": "Talla única",
    "talla unica": "Talla única",
    "única": "Talla única",
    "os": "Talla única",
    "unique": "Talla única",
    "talla única": "Talla única"
  };

  if (lower in synonymMap) {
    return synonymMap[lower];
  }

  for (const size of allowed) {
    if (size.toLowerCase() === lower) {
      return size;
    }
  }

  for (const size of allowed) {
    const escaped = size.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(normalized)) {
      return size;
    }
  }

  const numberMatches = normalized.match(/\d+/g);
  if (numberMatches) {
    const num = Number(numberMatches[0]);
    if (!isNaN(num)) {
      const euMap: [number, string][] = [
        [30, "XS"], [32, "XS"], [34, "XS"],
        [36, "S"], [38, "S"],
        [40, "M"], [42, "M"],
        [44, "L"], [46, "L"],
        [48, "XL"], [50, "XL"],
        [52, "XXL"], [54, "XXL"],
        [56, "XXXL"], [58, "XXXL"],
        [60, "4XL"], [62, "4XL"],
        [64, "5XL"], [66, "5XL"],
        [68, "6XL"], [70, "6XL"],
        [72, "7XL"], [74, "7XL"],
        [76, "8XL"], [78, "8XL"]
      ];

      const ukMap: [number, string][] = [
        [2, "XS"], [4, "XS"], [6, "XS"],
        [8, "S"], [10, "S"],
        [12, "M"], [14, "M"],
        [16, "L"], [18, "L"],
        [20, "XL"], [22, "XL"],
        [24, "XXL"], [26, "XXL"]
      ];

      let size: string | null = null;
      if (num >= 30 && num <= 80) {
        for (const [threshold, s] of euMap) {
          if (num <= threshold + 2) { size = s; break; }
        }
      } else if (num >= 2 && num <= 28) {
        for (const [threshold, s] of ukMap) {
          if (num <= threshold + 1) { size = s; break; }
        }
      }
      if (size && allowed.has(size)) return size;
    }
  }

  return null;
}