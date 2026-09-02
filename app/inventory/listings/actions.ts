"use server";

import connectMongo from "@/libs/mongoose";
import Listing from "@/models/Listing";
import Publication from "@/models/Publication";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import { revalidatePath } from "next/cache";
import { deleteImagesByUrls } from "@/utils/r2/deleteImage";
import mongoose from "mongoose";
import { validateListingCreationFields } from "@/libs/listings/validation";
import { ListingForm, Listing as ListingType } from "./types"

export async function deleteListing(id: string) {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error("No autenticado");

  await connectMongo();

  const listing = await Listing.findOne({ _id: id, userId });
  if (!listing) throw new Error("Producto no encontrado");

  await Publication.deleteMany({ listingId: listing._id });
  await Listing.deleteOne({ _id: listing._id });

  if (listing.photoUrl?.length > 0) {
    try {
      await deleteImagesByUrls(listing.photoUrl);
    } catch (imgErr) {
      console.error(`Error borrando imágenes de R2 para listing ${id}:`, imgErr);
    }
  }

  revalidatePath("/inventory/listings");
}


function toListingType(doc: any): ListingType {
  return {
    id: doc._id.toString(),
    profile_id: doc.userId.toString(),
    title: doc.title,
    sku: doc.sku ?? "",
    status: doc.status,
    tags: doc.tags ?? "",
    condition: doc.condition,
    description: doc.description,
    photo_url: doc.photoUrl ?? [],
    price: typeof doc.price === "number" ? doc.price : 0,
    delivery_method: doc.deliveryMethod ?? "",
    attributes: doc.attributes ?? {},
    created_at: (doc.createdAt ?? doc.lastUpdate ?? new Date()).toString(),
    last_update: doc.lastUpdate.toString(),
    colors: doc.colors ?? [],
    gender: doc.gender ?? null,
    item_type: doc.itemType ?? null,
    stock: doc.stock ?? 1,
    platforms: [],
  };
}

export async function createListingsFromBulk(data: ListingForm): Promise<ListingType> {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error("No autenticado");

  const validationError = validateListingCreationFields(data);
  if (validationError) throw new Error(validationError);

  await connectMongo();

  const created = await Listing.create({
    userId: new mongoose.Types.ObjectId(userId),
    title: data.title,
    description: data.description,
    condition: data.condition,
    price: data.price === "" ? null : data.price,
    photoUrl: data.photo_url,
    colors: data.colors,
    attributes: data.attributes,
    gender: data.gender,
    itemType: data.item_type,
    stock: data.stock ?? 1,
    status: "active",
    lastUpdate: new Date(),
  });

  revalidatePath("/inventory/listings");

  return toListingType(created);
}