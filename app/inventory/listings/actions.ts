"use server";

import connectMongo from "@/libs/mongoose";
import Listing from "@/models/Listing";
import Publication from "@/models/Publication";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import { revalidatePath } from "next/cache";
import { deleteImagesByUrls } from "@/utils/r2/deleteImage";

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