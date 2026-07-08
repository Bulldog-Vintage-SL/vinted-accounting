"use server";

import connectMongo from "@/libs/mongoose";
import Listing from "@/models/Listing";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import { ListingForm } from "../types";
import { redirect } from "next/navigation";
import mongoose from "mongoose";

export async function createListingFromForm(data: ListingForm) {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error("No autenticado");

  await connectMongo();
  await Listing.create({
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

  redirect("/inventory/listings");
}
