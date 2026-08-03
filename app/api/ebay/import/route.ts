import { NextRequest, NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Listing from "@/models/Listing";
import Publication from "@/models/Publication";
import Account from "@/models/Account";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import { getEbayAccountContext } from "@/libs/ebay/policies";
import {
  getEbayInventoryItem,
  listEbayOffers,
} from "@/libs/ebay/inventory";
import {
  buildEbayListingUrl,
  mapEbayOfferStatus,
} from "@/libs/ebay/mappers";
import { getEbayMarketplaceId } from "@/libs/ebay/client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function reverseConditionFromEbay(condition?: string): string | null {
  const map: Record<string, string> = {
    NEW: "Nuevo",
    LIKE_NEW: "Como nuevo",
    USED_GOOD: "Bueno",
    USED_ACCEPTABLE: "Aceptable",
    USED_EXCELLENT: "Bueno",
  };
  return condition ? map[condition] ?? null : null;
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { accountId } = await req.json();
  if (!accountId) {
    return NextResponse.json({ error: "falta accountId" }, { status: 400 });
  }

  let accessToken: string;
  let account: Awaited<ReturnType<typeof getEbayAccountContext>>["account"];

  try {
    const ctx = await getEbayAccountContext(accountId, userId);
    accessToken = ctx.accessToken;
    account = ctx.account;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "cuenta no encontrada" },
      { status: 404 }
    );
  }

  await connectMongo();

  const marketplaceId = account.ebayMarketplaceId || getEbayMarketplaceId();
  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const offers = await listEbayOffers(accessToken, limit, offset);
    if (offers.length === 0) break;

    for (const offer of offers) {
      try {
        const item = await getEbayInventoryItem(accessToken, offer.sku);
        if (!item) continue;

        const externalId = offer.listingId || offer.offerId;
        const existingPub = await Publication.findOne({
          accountId: account._id,
          platform: "ebay",
          $or: [{ externalId }, { ebayOfferId: offer.offerId }],
        });

        const price = offer.pricingSummary?.price?.value
          ? parseFloat(offer.pricingSummary.price.value)
          : null;

        const listingPayload = {
          userId: account.userId,
          title: item.product?.title ?? offer.sku,
          description: item.product?.description ?? "",
          photoUrl: item.product?.imageUrls ?? [],
          price,
          condition: reverseConditionFromEbay(item.condition),
          stock: item.availability?.shipToLocationAvailability?.quantity ?? 1,
          attributes: {
            brand: item.product?.aspects?.Brand?.[0] ?? null,
            ebayCategoryId: offer.categoryId ?? null,
          },
          lastUpdate: new Date(),
        };

        const publicationUrl = offer.listingId
          ? buildEbayListingUrl(offer.listingId, marketplaceId)
          : null;

        if (existingPub) {
          await Listing.findByIdAndUpdate(existingPub.listingId, listingPayload);
          await Publication.findByIdAndUpdate(existingPub._id, {
            externalId,
            ebayOfferId: offer.offerId,
            ebaySku: offer.sku,
            price,
            status: mapEbayOfferStatus(offer.status),
            publicationUrl,
            syncStatus: "OK",
            lastSync: new Date(),
          });
          updated++;
        } else {
          const newListing = await Listing.create(listingPayload);
          await Publication.create({
            listingId: newListing._id,
            platform: "ebay",
            platformId: marketplaceId,
            externalId,
            ebayOfferId: offer.offerId,
            ebaySku: offer.sku,
            price,
            status: mapEbayOfferStatus(offer.status),
            publicationUrl,
            syncStatus: "OK",
            lastSync: new Date(),
            accountId: account._id,
          });
          created++;
        }
      } catch (err) {
        errors.push(
          `${offer.sku}: ${err instanceof Error ? err.message : "error desconocido"}`
        );
      }
    }

    offset += offers.length;
    hasMore = offers.length === limit;
  }

  await Account.findByIdAndUpdate(account._id, { lastSync: new Date() });

  return NextResponse.json({
    ok: true,
    total: created + updated,
    created,
    updated,
    errors,
  });
}
