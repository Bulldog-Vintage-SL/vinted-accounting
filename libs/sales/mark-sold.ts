import mongoose from "mongoose";
import Listing from "@/models/Listing";
import Publication from "@/models/Publication";
import Sale from "@/models/Sale";

export class MarkSoldError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "MarkSoldError";
    this.status = status;
  }
}

export interface MarkListingSoldInput {
  userId: string;
  listingId: string;
  publicationId?: string | null;
  platform?: string | null;
  salePrice?: number | null;
  saleDate?: string | Date | null;
  purchasePrice?: number | null;
}

function parseAmount(value: number | null | undefined, fallback: number): number {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return fallback;
  }
  const amount = Number(value);
  return amount >= 0 ? amount : fallback;
}

export async function markListingAsSold(input: MarkListingSoldInput) {
  const listing = await Listing.findOne({
    _id: input.listingId,
    userId: input.userId,
  });

  if (!listing) {
    throw new MarkSoldError("Producto no encontrado", 404);
  }

  if (listing.status === "sold") {
    throw new MarkSoldError("Este producto ya está marcado como vendido", 409);
  }

  const existingSale = await Sale.findOne({ listingId: listing._id });
  if (existingSale) {
    throw new MarkSoldError("Este producto ya tiene una venta asociada", 409);
  }

  const publications = await Publication.find({ listingId: listing._id });

  let publication =
    (input.publicationId
      ? publications.find((p) => p._id?.toString() === input.publicationId)
      : undefined) ?? null;

  if (input.publicationId && !publication) {
    throw new MarkSoldError("Publicación no encontrada para este producto", 404);
  }

  if (!publication && input.platform) {
    publication =
      publications.find((p) => p.platform === input.platform) ?? null;
  }

  const platform = publication?.platform ?? input.platform?.trim() ?? "manual";
  const fallbackPrice = Number(publication?.price ?? listing.price ?? 0);
  const amount = parseAmount(input.salePrice, fallbackPrice);
  const purchasePrice = parseAmount(input.purchasePrice, 0);
  const saleDate = input.saleDate ? new Date(input.saleDate) : new Date();

  if (Number.isNaN(saleDate.getTime())) {
    throw new MarkSoldError("Fecha de venta inválida", 400);
  }

  const stamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);

  const sale = await Sale.create({
    userId: new mongoose.Types.ObjectId(input.userId),
    emailId: `listing-${listing._id}-${stamp}-${random}`,
    transactionId: `LISTING-${stamp}-${random}`,
    itemName: listing.title?.trim() || "Artículo sin título",
    amount,
    purchasePrice,
    status: "completed",
    shippingCarrier: "unknown",
    saleDate,
    completedDate: saleDate,
    hasLabel: false,
    isManual: true,
    listingId: listing._id,
    publicationId: publication?._id,
    platform,
    itemImageUrl: listing.photoUrl?.[0] ?? null,
  });

  const updatedListing = await Listing.findByIdAndUpdate(
    listing._id,
    {
      status: "sold",
      stock: 0,
      lastUpdate: new Date(),
    },
    { new: true }
  );

  const closeResult = await Publication.updateMany(
    { listingId: listing._id },
    {
      status: "closed",
      lastSync: new Date(),
    }
  );

  return {
    sale,
    listing: updatedListing,
    closedPublications: closeResult.modifiedCount,
    platform,
  };
}

export async function closeListingInventory(listingId: mongoose.Types.ObjectId) {
  await Listing.findByIdAndUpdate(listingId, {
    status: "sold",
    stock: 0,
    lastUpdate: new Date(),
  });

  const closeResult = await Publication.updateMany(
    { listingId },
    {
      status: "closed",
      lastSync: new Date(),
    }
  );

  return closeResult.modifiedCount;
}

export async function linkSaleToListing(input: {
  userId: string;
  saleId: string;
  listingId: string;
  platform: string;
  publicationId?: string | null;
}): Promise<{ linked: boolean; reason?: string }> {
  const sale = await Sale.findOne({
    _id: input.saleId,
    userId: input.userId,
  });
  if (!sale) return { linked: false, reason: "sale-not-found" };
  if (sale.listingId) return { linked: false, reason: "already-linked" };

  const listing = await Listing.findOne({
    _id: input.listingId,
    userId: input.userId,
  });
  if (!listing) return { linked: false, reason: "listing-not-found" };

  const taken = await Sale.findOne({
    listingId: listing._id,
    _id: { $ne: sale._id },
  });
  if (taken) return { linked: false, reason: "listing-has-sale" };

  let publication = input.publicationId
    ? await Publication.findOne({
        _id: input.publicationId,
        listingId: listing._id,
      })
    : null;

  if (!publication) {
    publication = await Publication.findOne({
      listingId: listing._id,
      platform: input.platform,
    });
  }

  sale.listingId = listing._id;
  sale.publicationId = publication?._id;
  sale.platform = input.platform;
  if (!sale.itemImageUrl && listing.photoUrl?.[0]) {
    sale.itemImageUrl = listing.photoUrl[0];
  }
  await sale.save();

  if (listing.status !== "sold") {
    await closeListingInventory(listing._id as mongoose.Types.ObjectId);
  }

  return { linked: true };
}
