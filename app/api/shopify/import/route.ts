import { NextRequest, NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Listing from "@/models/Listing";
import Publication from "@/models/Publication";
import Account from "@/models/Account";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";

export const dynamic = "force-dynamic";

const PRODUCTS_QUERY = `
  query GetProducts($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        descriptionHtml
        vendor
        onlineStorePreviewUrl
        productType
        tags
        status
        images(first: 10) {
          nodes {
            url
          }
        }
        variants(first: 1) {
          nodes {
            id
            price
            sku
            inventoryQuantity
          }
        }
      }
    }
  }
`;

interface ShopifyProductNode {
  id: string;
  title: string;
  descriptionHtml: string;
  onlineStorePreviewUrl: string;
  vendor: string;
  productType: string;
  tags: string[];
  status: string;
  images: { nodes: { url: string }[] };
  variants: {
    nodes: {
      id: string;
      price: string;
      sku: string;
      inventoryQuantity: number;
    }[];
  };
}

function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

async function fetchAllProducts(
  shop: string,
  accessToken: string
): Promise<ShopifyProductNode[]> {
  const allProducts: ShopifyProductNode[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const res = await fetch(`https://${shop}/admin/api/2026-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query: PRODUCTS_QUERY,
        variables: { cursor },
      }),
    });

    if (!res.ok) {
      throw new Error(`Shopify API respondió ${res.status}`);
    }

    const json = await res.json();
    if (json.errors) {
      throw new Error(json.errors.map((e: any) => e.message).join(", "));
    }
    if (!json.data) {
      throw new Error("respuesta de Shopify sin datos");
    }

    const { nodes, pageInfo } = json.data.products;
    allProducts.push(...nodes);
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  return allProducts;
}

function mapShopifyStatus(status: string): string {
  if (status === "ACTIVE") return "active";
  if (status === "DRAFT") return "draft";
  return "archived";
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

  await connectMongo();
  const account = await Account.findOne({
    _id: accountId,
    userId,
    platform: "shopify",
  });

  if (!account) {
    return NextResponse.json({ error: "cuenta no encontrada" }, { status: 404 });
  }

  if (!account.shopifyShopDomain || !account.shopifyAccessToken) {
    return NextResponse.json(
      { error: "cuenta de Shopify incompleta" },
      { status: 400 }
    );
  }

  let products: ShopifyProductNode[];
  try {
    products = await fetchAllProducts(
      account.shopifyShopDomain,
      account.shopifyAccessToken
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: `fallo al obtener productos de Shopify: ${err.message}` },
      { status: 502 }
    );
  }

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const product of products) {
    try {
      const variant = product.variants.nodes[0];
      const photoUrls = product.images.nodes.map((img) => img.url);

      const existingPub = await Publication.findOne({
        accountId: account._id,
        externalId: product.id,
      });

      const listingPayload = {
        userId: account.userId,
        title: product.title,
        sku: variant?.sku || null,
        status: mapShopifyStatus(product.status),
        tags: product.tags,
        description: stripHtml(product.descriptionHtml),
        photoUrl: photoUrls,
        price: variant?.price ? parseFloat(variant.price) : null,
        stock: variant?.inventoryQuantity ?? 0,
        itemType: product.productType || null,
        lastUpdate: new Date(),
      };

      if (existingPub) {

        await Listing.findByIdAndUpdate(existingPub.listingId, listingPayload);

        await Publication.findByIdAndUpdate(existingPub._id, {
          status: mapShopifyStatus(product.status),
          price: listingPayload.price,
          publicationUrl: product.onlineStorePreviewUrl,
          syncStatus: "OK",
          lastSync: new Date(),
        });

        updated++;
      } else {
        const newListing = await Listing.create(listingPayload);
        created++;

        await Publication.create({
          listingId: newListing._id,
          platform: "shopify",
          platformId: account.shopifyShopDomain,
          externalId: product.id,
          shopifyVariantId: variant?.id ?? null,
          status: mapShopifyStatus(product.status),
          price: listingPayload.price,
          publicationUrl: product.onlineStorePreviewUrl,
          syncStatus: "OK",
          lastSync: new Date(),
          accountId: account._id,
        });
      }
    } catch (err: any) {
      errors.push(`${product.title}: ${err.message || "error desconocido"}`);
    }
  }

  account.lastSync = new Date();
  await account.save();

  return NextResponse.json({
    ok: true,
    total: products.length,
    created,
    updated,
    errors,
  });
}