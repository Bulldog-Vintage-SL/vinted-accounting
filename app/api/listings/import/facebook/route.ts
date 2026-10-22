import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectMongo from "@/libs/mongoose";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import Account from "@/models/Account";
import Listing from "@/models/Listing";
import Publication from "@/models/Publication";
import { uploadImageFromBase64 } from "@/utils/r2/uploadImage";

export const dynamic = "force-dynamic";

function parseAttributes(item: any): Record<string, any> {
  const raw = item.attribute_data_json;
  if (raw && typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      throw new Error(
        `No se pudieron interpretar los atributos de Facebook: ${
          error instanceof Error ? error.message : "JSON inválido"
        }`
      );
    }
  }
  return {};
}

function parsePrice(item: any): number {
  const raw = item.listing_price?.amount ?? item.listing_price?.formatted_amount;
  const normalized = String(raw ?? "").replace(/[^\d,.-]/g, "").replace(",", ".");
  const price = Number(normalized);
  return Number.isFinite(price) && price >= 0 ? price : 0;
}

function attributeText(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return text || null;
  }
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  return attributeText(candidate.name ?? candidate.label ?? candidate.value);
}

function parseColors(attributes: Record<string, any>): string[] {
  const raw =
    attributes.color ??
    attributes.color_name ??
    attributes.colors ??
    attributes.colour ??
    attributes.colours;
  const values = Array.isArray(raw) ? raw : [raw];
  return [...new Set(values.map(attributeText).filter((value): value is string => Boolean(value)))];
}

function getStatus(item: any): string {
  if (item.is_sold) return "closed";
  if (item.is_pending) return "pending";
  if (item.is_hidden || item.is_live === false) return "hidden";
  return "active";
}

function getCondition(value: unknown): string | null {
  const condition = (attributeText(value) ?? "").toLowerCase();
  if (condition === "new") return "Nuevo";
  if (condition === "used_like_new") return "Como nuevo";
  if (condition === "used_good") return "Bueno";
  if (condition === "used_fair") return "Aceptable";
  return null;
}

function getPhotoBase64(item: any): string | null {
  const image = item.photoBase64;
  if (image == null) return null;
  if (
    typeof image !== "string" ||
    image.length > 10 * 1024 * 1024 ||
    !/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/i.test(image)
  ) {
    throw new Error("La imagen recibida de Facebook no es válida o supera el tamaño máximo");
  }
  return image;
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
    if (!mongoose.isValidObjectId(body.accountId) || !Array.isArray(body.wardrobe)) {
      return NextResponse.json(
        { status: "error", message: "Cuenta o lista de publicaciones inválida" },
        { status: 400 }
      );
    }

    await connectMongo();
    const account = await Account.findOne({
      _id: body.accountId,
      userId,
      platform: "facebook",
    }).select("_id externalId");
    if (!account) {
      return NextResponse.json(
        { status: "error", message: "Cuenta de Facebook no encontrada" },
        { status: 404 }
      );
    }

    let created = 0;
    let alreadyImported = 0;
    let blockedByOtherUser = 0;

    for (const item of body.wardrobe) {
      const result = await importPublication(item, userId, account._id);
      if (result === "created") created++;
      else if (result === "already-imported") alreadyImported++;
      else blockedByOtherUser++;
    }

    const parts = [`${created} importados`];
    if (alreadyImported) parts.push(`${alreadyImported} ya existentes`);
    if (blockedByOtherUser) parts.push(`${blockedByOtherUser} vinculados a otro usuario`);

    return NextResponse.json({
      status: "success",
      message: `Publicaciones de Facebook procesadas: ${parts.join(", ")}`,
      created,
      alreadyImported,
      blockedByOtherUser,
    });
  } catch (error) {
    console.error("Error importando publicaciones de Facebook:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 400 }
    );
  }
}

async function importPublication(
  item: any,
  userId: string,
  accountId: mongoose.Types.ObjectId
): Promise<"created" | "already-imported" | "blocked-by-other-user"> {
  const externalId = item?.id;
  if (externalId == null || String(externalId).trim() === "") {
    throw new Error("Facebook devolvió una publicación sin id");
  }

  const platform = "facebook";
  const externalIdString = String(externalId);
  const existingPublication = await Publication.findOne({ platform, externalId: externalIdString });
  if (existingPublication) {
    const linkedListing = existingPublication.listingId
      ? await Listing.findById(existingPublication.listingId)
      : null;
    if (linkedListing && linkedListing.userId?.toString() === userId) return "already-imported";
    if (linkedListing) return "blocked-by-other-user";
    await Publication.deleteOne({ _id: existingPublication._id });
  }

  const photoBase64 = getPhotoBase64(item);
  const photoUrls = photoBase64
    ? [await uploadImageFromBase64(photoBase64, `listings/${userId}/${externalIdString}_0.webp`)]
    : [];
  const attributes = parseAttributes(item);
  const status = getStatus(item);
  const price = parsePrice(item);
  const title = String(item.marketplace_listing_title ?? item.title ?? "Artículo Facebook Marketplace");
  const description = item.description?.text ?? item.description ?? "";
  const location = item.location?.reverse_geocode;
  const brand = attributeText(
    attributes.brand ?? item.brand ?? item.marketplace_listing_brand
  );
  const size = attributeText(attributes.size ?? item.size);
  const colors = parseColors(attributes);
  const publicationUrl =
    item.story?.url ?? `https://www.facebook.com/marketplace/item/${encodeURIComponent(externalIdString)}`;

  const listing = await Listing.create({
    userId: new mongoose.Types.ObjectId(userId),
    title,
    description: typeof description === "string" ? description : "",
    status,
    condition: getCondition(attributes.condition ?? item.condition),
    price,
    photoUrl: photoUrls,
    colors,
    attributes: {
      ...attributes,
      brand,
      size,
      color: colors,
      facebookCategoryId: item.marketplace_listing_category_id ?? null,
      facebookOriginalPrice: item.strikethrough_price ?? null,
      facebookSellerName: item.marketplace_listing_seller?.name ?? null,
      facebookAttributes: attributes,
      facebookLocation: {
        city: location?.city ?? null,
        state: location?.state ?? null,
      },
      facebookDeliveryTypes: Array.isArray(item.delivery_types) ? item.delivery_types : [],
    },
    gender: attributeText(attributes.gender),
    itemType: attributeText(attributes.item_type ?? attributes.category),
    stock: 1,
  });

  await Publication.create({
    listingId: listing._id,
    platform,
    externalId: externalIdString,
    price,
    status,
    syncStatus: "live",
    lastSync: new Date(),
    publicationUrl,
    accountId,
  });

  return "created";
}
