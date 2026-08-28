import mongoose from "mongoose";
import Account from "@/models/Account";
import Sale from "@/models/Sale";
import { getValidEbayAccessToken } from "@/libs/ebay/account-token";
import { listPaidEbayOrderLines } from "@/libs/ebay/orders";
import {
  listPaidShopifyOrderLines,
  ShopifyOrdersScopeError,
} from "@/libs/shopify/orders";
import { findListingForMarketplaceItem } from "@/libs/sales/match-listing";
import { linkSaleToListing } from "@/libs/sales/mark-sold";

export interface MarketplaceOrderSyncSummary {
  ebay: { accounts: number; lines: number; newSales: number; matched: number; errors: number };
  shopify: {
    accounts: number;
    lines: number;
    newSales: number;
    matched: number;
    errors: number;
    needsReconnect: boolean;
  };
}

async function upsertExternalSale(input: {
  userId: string;
  emailId: string;
  transactionId: string;
  itemName: string;
  amount: number;
  saleDate: Date;
  platform: string;
  snippet?: string;
}) {
  const existing = await Sale.findOne({ emailId: input.emailId });
  if (existing) {
    existing.itemName = input.itemName;
    existing.amount = input.amount || existing.amount;
    existing.platform = input.platform;
    existing.transactionId = existing.transactionId || input.transactionId;
    if (input.snippet) existing.snippet = input.snippet;
    await existing.save();
    return { sale: existing, created: false };
  }

  const sale = await Sale.create({
    userId: new mongoose.Types.ObjectId(input.userId),
    emailId: input.emailId,
    transactionId: input.transactionId,
    itemName: input.itemName,
    amount: input.amount,
    purchasePrice: 0,
    status: "completed",
    shippingCarrier: "unknown",
    saleDate: input.saleDate,
    completedDate: input.saleDate,
    hasLabel: false,
    isManual: false,
    platform: input.platform,
    snippet: input.snippet,
  });

  return { sale, created: true };
}

async function tryLinkSale(
  userId: string,
  saleId: string,
  match: { listingId: string; publicationId?: string | null } | null,
  platform: string
): Promise<boolean> {
  if (!match) return false;
  const result = await linkSaleToListing({
    userId,
    saleId,
    listingId: match.listingId,
    platform,
    publicationId: match.publicationId,
  });
  return result.linked;
}

export async function syncMarketplaceOrdersForUser(
  userId: string
): Promise<MarketplaceOrderSyncSummary> {
  const summary: MarketplaceOrderSyncSummary = {
    ebay: { accounts: 0, lines: 0, newSales: 0, matched: 0, errors: 0 },
    shopify: {
      accounts: 0,
      lines: 0,
      newSales: 0,
      matched: 0,
      errors: 0,
      needsReconnect: false,
    },
  };

  const ebayAccounts = await Account.find({ userId, platform: "ebay" });
  summary.ebay.accounts = ebayAccounts.length;

  for (const account of ebayAccounts) {
    try {
      const accessToken = await getValidEbayAccessToken(account);
      const lines = await listPaidEbayOrderLines(accessToken);
      summary.ebay.lines += lines.length;

      for (const line of lines) {
        try {
          const { sale, created } = await upsertExternalSale({
            userId,
            emailId: `ebay-${line.orderId}-${line.lineItemId}`,
            transactionId: line.orderId,
            itemName: line.title,
            amount: line.amount,
            saleDate: new Date(line.createdAt),
            platform: "ebay",
            snippet: line.sku ? `SKU ${line.sku}` : undefined,
          });
          if (created) summary.ebay.newSales++;

          if (!sale.listingId) {
            const match = await findListingForMarketplaceItem(userId, {
              platform: "ebay",
              sku: line.sku,
              title: line.title,
              accountId: account._id?.toString(),
            });
            if (await tryLinkSale(userId, sale._id!.toString(), match, "ebay")) {
              summary.ebay.matched++;
            }
          }
        } catch (err) {
          console.error("eBay order line sync error:", err);
          summary.ebay.errors++;
        }
      }
    } catch (err) {
      console.error("eBay account order sync error:", err);
      summary.ebay.errors++;
    }
  }

  const shopifyAccounts = await Account.find({ userId, platform: "shopify" });
  summary.shopify.accounts = shopifyAccounts.length;

  for (const account of shopifyAccounts) {
    if (!account.shopifyShopDomain || !account.shopifyAccessToken) {
      summary.shopify.errors++;
      continue;
    }

    try {
      const lines = await listPaidShopifyOrderLines(
        account.shopifyShopDomain,
        account.shopifyAccessToken
      );
      summary.shopify.lines += lines.length;

      for (const line of lines) {
        try {
          const { sale, created } = await upsertExternalSale({
            userId,
            emailId: `shopify-${line.orderId}-${line.lineItemId}`,
            transactionId: line.orderName || line.orderId,
            itemName: line.title,
            amount: line.amount,
            saleDate: new Date(line.createdAt),
            platform: "shopify",
            snippet: line.sku ? `SKU ${line.sku}` : undefined,
          });
          if (created) summary.shopify.newSales++;

          if (!sale.listingId) {
            const match = await findListingForMarketplaceItem(userId, {
              platform: "shopify",
              sku: line.sku,
              productId: line.productId,
              variantId: line.variantId,
              title: line.title,
              accountId: account._id?.toString(),
            });
            if (
              await tryLinkSale(userId, sale._id!.toString(), match, "shopify")
            ) {
              summary.shopify.matched++;
            }
          }
        } catch (err) {
          console.error("Shopify order line sync error:", err);
          summary.shopify.errors++;
        }
      }
    } catch (err) {
      if (err instanceof ShopifyOrdersScopeError) {
        summary.shopify.needsReconnect = true;
        console.warn(err.message);
      } else {
        console.error("Shopify account order sync error:", err);
        summary.shopify.errors++;
      }
    }
  }

  return summary;
}
