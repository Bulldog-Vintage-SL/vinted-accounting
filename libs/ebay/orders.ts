import { ebayApiRequest } from "@/libs/ebay/api";

export interface EbayOrderLine {
  orderId: string;
  lineItemId: string;
  sku: string | null;
  title: string;
  amount: number;
  quantity: number;
  createdAt: string;
  listingId: string | null;
}

interface EbayOrderListResponse {
  href?: string;
  next?: string;
  offset?: number;
  limit?: number;
  total?: number;
  orders?: Array<{
    orderId?: string;
    creationDate?: string;
    orderPaymentStatus?: string;
    lineItems?: Array<{
      lineItemId?: string;
      sku?: string;
      title?: string;
      quantity?: number;
      lineItemCost?: { value?: string };
      total?: { value?: string };
      listing?: { listingId?: string };
    }>;
    pricingSummary?: { total?: { value?: string } };
  }>;
}

function toAmount(value?: string): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export async function listPaidEbayOrderLines(
  accessToken: string,
  options?: { limit?: number }
): Promise<EbayOrderLine[]> {
  const pageSize = 50;
  const max = Math.min(options?.limit ?? 100, 200);
  const lines: EbayOrderLine[] = [];
  let offset = 0;

  while (lines.length < max) {
    const remaining = Math.min(pageSize, max - lines.length);
    const path =
      `/sell/fulfillment/v1/order?limit=${remaining}&offset=${offset}` +
      `&filter=${encodeURIComponent("orderpaymentstatus:{PAID}")}`;

    const data = await ebayApiRequest<EbayOrderListResponse>(
      accessToken,
      "GET",
      path
    );

    const orders = data.orders ?? [];
    for (const order of orders) {
      if (!order.orderId) continue;
      for (const item of order.lineItems ?? []) {
        if (!item.lineItemId) continue;
        lines.push({
          orderId: order.orderId,
          lineItemId: item.lineItemId,
          sku: item.sku?.trim() || null,
          title: item.title?.trim() || "Artículo eBay",
          amount: toAmount(item.total?.value ?? item.lineItemCost?.value),
          quantity: item.quantity ?? 1,
          createdAt: order.creationDate || new Date().toISOString(),
          listingId: item.listing?.listingId ?? null,
        });
      }
    }

    if (orders.length < remaining) break;
    offset += remaining;
  }

  return lines;
}
