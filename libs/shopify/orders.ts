const SHOPIFY_API_VERSION = "2026-07";

const PAID_ORDERS_QUERY = `
  query PaidOrders($first: Int!) {
    orders(first: $first, reverse: true, sortKey: CREATED_AT, query: "financial_status:paid") {
      edges {
        node {
          id
          name
          createdAt
          lineItems(first: 50) {
            edges {
              node {
                id
                title
                sku
                quantity
                originalTotalSet { shopMoney { amount } }
                variant { id sku }
                product { id }
              }
            }
          }
        }
      }
    }
  }
`;

export interface ShopifyOrderLine {
  orderId: string;
  orderName: string;
  lineItemId: string;
  title: string;
  sku: string | null;
  variantId: string | null;
  productId: string | null;
  amount: number;
  quantity: number;
  createdAt: string;
}

interface ShopifyOrdersResponse {
  data?: {
    orders?: {
      edges?: Array<{
        node?: {
          id?: string;
          name?: string;
          createdAt?: string;
          lineItems?: {
            edges?: Array<{
              node?: {
                id?: string;
                title?: string;
                sku?: string | null;
                quantity?: number;
                originalTotalSet?: { shopMoney?: { amount?: string } };
                variant?: { id?: string; sku?: string | null } | null;
                product?: { id?: string } | null;
              };
            }>;
          };
        };
      }>;
    };
  };
  errors?: Array<{ message?: string }>;
}

export class ShopifyOrdersScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopifyOrdersScopeError";
  }
}

export async function listPaidShopifyOrderLines(
  shopDomain: string,
  accessToken: string,
  options?: { limit?: number }
): Promise<ShopifyOrderLine[]> {
  const first = Math.min(options?.limit ?? 50, 50);
  const res = await fetch(
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query: PAID_ORDERS_QUERY,
        variables: { first },
      }),
    }
  );

  const payload = (await res.json()) as ShopifyOrdersResponse;
  const errorText = JSON.stringify(payload.errors ?? []);

  if (
    res.status === 401 ||
    res.status === 403 ||
    /ACCESS_DENIED|read_orders|access denied/i.test(errorText)
  ) {
    throw new ShopifyOrdersScopeError(
      "Shopify no tiene permiso read_orders. Reconecta la tienda en Ajustes."
    );
  }

  if (!res.ok || payload.errors?.length) {
    throw new Error(
      payload.errors?.[0]?.message ||
        `Shopify orders failed (${res.status})`
    );
  }

  const lines: ShopifyOrderLine[] = [];
  for (const edge of payload.data?.orders?.edges ?? []) {
    const order = edge.node;
    if (!order?.id) continue;
    for (const itemEdge of order.lineItems?.edges ?? []) {
      const item = itemEdge.node;
      if (!item?.id) continue;
      lines.push({
        orderId: order.id,
        orderName: order.name ?? order.id,
        lineItemId: item.id,
        title: item.title?.trim() || "Artículo Shopify",
        sku: item.variant?.sku?.trim() || item.sku?.trim() || null,
        variantId: item.variant?.id ?? null,
        productId: item.product?.id ?? null,
        amount: Number(item.originalTotalSet?.shopMoney?.amount ?? 0) || 0,
        quantity: item.quantity ?? 1,
        createdAt: order.createdAt || new Date().toISOString(),
      });
    }
  }

  return lines;
}
