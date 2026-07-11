"use server";

import connectMongo from "@/libs/mongoose";
import Listing from "@/models/Listing";
import Publication from "@/models/Publication";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import { revalidatePath } from "next/cache";

export async function deleteListing(id: string) {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error("No autenticado");

  await connectMongo();

  const listing = await Listing.findOne({ _id: id, userId });
  if (!listing) throw new Error("Producto no encontrado");

  await Publication.deleteMany({ listingId: listing._id });
  await Listing.deleteOne({ _id: listing._id });

  revalidatePath("/inventory/listings");
}