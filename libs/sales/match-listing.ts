import mongoose from "mongoose";
import Listing from "@/models/Listing";
import Publication from "@/models/Publication";
import Sale from "@/models/Sale";
import { normalizeSaleItemName } from "@/libs/sales/images";
import { linkSaleToListing } from "@/libs/sales/mark-sold";

const GENERIC_NAMES = new Set([
  "artículo desconocido",
  "articulo desconocido",
  "devolución parcial",
  "devolucion parcial",
  "artículo",
  "articulo",
]);

export interface ListingMatch {
  listingId: string;
  publicationId?: string | null;
}

export function isGenericSaleName(name: string | null | undefined): boolean {
  const key = normalizeSaleItemName(name ?? "");
  return !key || key.length < 4 || GENERIC_NAMES.has(key);
}

export async function findListingForMarketplaceItem(
  userId: string,
  input: {
    platform: string;
    sku?: string | null;
    productId?: string | null;
    variantId?: string | null;
    title?: string | null;
    accountId?: string | null;
  }
): Promise<ListingMatch | null> {
  const accountFilter = input.accountId
    ? { accountId: new mongoose.Types.ObjectId(input.accountId) }
    : {};

  if (input.platform === "ebay" && input.sku?.trim()) {
    const sku = input.sku.trim();
    const pub = await Publication.findOne({
      platform: "ebay",
      ebaySku: sku,
      ...accountFilter,
    });
    if (pub && (await listingOwnedAndAvailable(userId, pub.listingId))) {
      return {
        listingId: pub.listingId.toString(),
        publicationId: pub._id?.toString(),
      };
    }

    const listing = await Listing.findOne({
      userId,
      sku,
      status: { $ne: "sold" },
    });
    if (listing) {
      const listingPub = await Publication.findOne({
        listingId: listing._id,
        platform: "ebay",
      });
      return {
        listingId: listing._id!.toString(),
        publicationId: listingPub?._id?.toString(),
      };
    }
  }

  if (input.platform === "shopify") {
    if (input.variantId) {
      const pub = await Publication.findOne({
        platform: "shopify",
        shopifyVariantId: input.variantId,
        ...accountFilter,
      });
      if (pub && (await listingOwnedAndAvailable(userId, pub.listingId))) {
        return {
          listingId: pub.listingId.toString(),
          publicationId: pub._id?.toString(),
        };
      }
    }

    if (input.productId) {
      const pub = await Publication.findOne({
        platform: "shopify",
        externalId: input.productId,
        ...accountFilter,
      });
      if (pub && (await listingOwnedAndAvailable(userId, pub.listingId))) {
        return {
          listingId: pub.listingId.toString(),
          publicationId: pub._id?.toString(),
        };
      }
    }

    if (input.sku?.trim()) {
      const listing = await Listing.findOne({
        userId,
        sku: input.sku.trim(),
        status: { $ne: "sold" },
      });
      if (listing) {
        const listingPub = await Publication.findOne({
          listingId: listing._id,
          platform: "shopify",
        });
        return {
          listingId: listing._id!.toString(),
          publicationId: listingPub?._id?.toString(),
        };
      }
    }
  }

  return findUniqueListingByTitle(userId, input.title, input.platform);
}

export async function findUniqueListingByTitle(
  userId: string,
  title: string | null | undefined,
  platform?: string
): Promise<ListingMatch | null> {
  if (isGenericSaleName(title)) return null;

  const needle = normalizeSaleItemName(title ?? "");
  const listings = await Listing.find({
    userId,
    status: { $ne: "sold" },
    title: { $exists: true, $ne: null },
  }).select("_id title");

  const exact = listings.filter(
    (listing) => normalizeSaleItemName(listing.title ?? "") === needle
  );

  const candidates =
    exact.length > 0
      ? exact
      : listings.filter((listing) => {
          const listingTitle = normalizeSaleItemName(listing.title ?? "");
          if (listingTitle.length < 12 || needle.length < 12) return false;
          return (
            listingTitle.startsWith(needle) || needle.startsWith(listingTitle)
          );
        });

  if (candidates.length !== 1) return null;

  const listing = candidates[0];
  const publication = platform
    ? await Publication.findOne({ listingId: listing._id, platform })
    : null;

  return {
    listingId: listing._id!.toString(),
    publicationId: publication?._id?.toString() ?? null,
  };
}

export async function matchUnlinkedVintedSales(userId: string): Promise<{
  matched: number;
  skipped: number;
}> {
  const sales = await Sale.find({
    userId,
    listingId: { $exists: false },
    itemName: { $exists: true, $ne: "" },
    $or: [{ platform: "vinted" }, { platform: null }, { platform: { $exists: false } }],
    isManual: { $ne: true },
  }).select("_id itemName");

  let matched = 0;
  let skipped = 0;

  for (const sale of sales) {
    const found = await findUniqueListingByTitle(
      userId,
      sale.itemName,
      "vinted"
    );
    if (!found) {
      skipped++;
      continue;
    }

    const result = await linkSaleToListing({
      userId,
      saleId: sale._id!.toString(),
      listingId: found.listingId,
      platform: "vinted",
      publicationId: found.publicationId,
    });

    if (result.linked) matched++;
    else skipped++;
  }

  return { matched, skipped };
}

async function listingOwnedAndAvailable(
  userId: string,
  listingId: mongoose.Types.ObjectId
): Promise<boolean> {
  const listing = await Listing.findOne({
    _id: listingId,
    userId,
    status: { $ne: "sold" },
  }).select("_id");
  return Boolean(listing);
}
