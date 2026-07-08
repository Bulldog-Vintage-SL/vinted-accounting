"use server";

import connectMongo from "@/libs/mongoose";
import Listing from "@/models/Listing";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import { revalidatePath } from "next/cache";

export async function deleteListing(id: string) {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error("No autenticado");

  await connectMongo();
  const result = await Listing.deleteOne({ _id: id, userId });
  if (result.deletedCount === 0) throw new Error("Producto no encontrado");

  revalidatePath("/inventory/listings");
}
