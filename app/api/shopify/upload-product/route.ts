import { NextRequest, NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Listing from "@/models/Listing";
import Account from "@/models/Account";
import Publication from "@/models/Publication";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";

const CREATE_PRODUCT_MUTATION = `
  mutation CreateProduct($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
    productCreate(product: $product, media: $media) {
      product {
        id
        status
        onlineStorePreviewUrl
        variants(first: 1) {
          edges {
            node { id inventoryItem { id } }
          }
        }
      }
      userErrors { field message }
    }
  }
`;

const UPDATE_VARIANT_MUTATION = `
  mutation UpdateVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id price }
      userErrors { field message }
    }
  }
`;

const LOCATIONS_QUERY = `
  query FirstLocation {
    locations(first: 1) {
      edges { node { id } }
    }
  }
`;

const SET_INVENTORY_MUTATION = `
  mutation SetInventory($input: InventorySetOnHandQuantitiesInput!) {
    inventorySetOnHandQuantities(input: $input) {
      inventoryAdjustmentGroup { id }
      userErrors { field message }
    }
  }
`;

function mapStatusToShopify(status: string): string {
  if (status === "active") return "ACTIVE";
  if (status === "draft") return "DRAFT";
  return "ARCHIVED";
}

function mapShopifyStatus(status: string): string {
  if (status === "ACTIVE") return "active";
  if (status === "DRAFT") return "draft";
  return "archived";
}

function buildTags(listing: any): string[] {
  const base = typeof listing.tags === "string"
    ? listing.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
    : [];

  if (listing.condition) base.push(`condition:${listing.condition}`);
  if (listing.gender) base.push(`gender:${listing.gender}`);
  if (listing.itemType) base.push(`tipo:${listing.itemType}`);
  if (Array.isArray(listing.colors)) base.push(...listing.colors);

  return base;
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { listingId, accountId } = await req.json();
  if (!listingId || !accountId) {
    return NextResponse.json({ error: "faltan parámetros" }, { status: 400 });
  }

  await connectMongo();

  const listing = await Listing.findOne({ _id: listingId, userId });
  if (!listing) {
    return NextResponse.json({ error: "listing no encontrado" }, { status: 404 });
  }

  const account = await Account.findOne({
    _id: accountId,
    userId,
    platform: "shopify",
  });
  if (!account) {
    return NextResponse.json({ error: "cuenta no encontrada" }, { status: 404 });
  }

  const shopUrl = `https://${account.shopifyShopDomain}/admin/api/2026-07/graphql.json`;
  const headers = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": account.shopifyAccessToken,
  };

  const media = (listing.photoUrl || []).map((url: string) => ({
    originalSource: url,
    mediaContentType: "IMAGE",
  }));

  const productRes = await fetch(shopUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: CREATE_PRODUCT_MUTATION,
      variables: {
        product: {
          title: listing.title,
          descriptionHtml: listing.description,
          vendor: listing.attributes?.brand,
          productType: listing.itemType,
          tags: buildTags(listing),
          status: mapStatusToShopify(listing.status),
        },
        media,
      },
    }),
  });

  const productJson = await productRes.json();
  const productErrors = productJson.data?.productCreate?.userErrors;

  if (productJson.errors || (productErrors && productErrors.length > 0)) {
    return NextResponse.json(
      {
        error:
          productJson.errors?.map((e: any) => e.message).join(", ") ||
          productErrors.map((e: any) => e.message).join(", "),
      },
      { status: 422 }
    );
  }

  const product = productJson.data.productCreate.product;
  const variant = product.variants.edges[0]?.node;

  if (!variant) {
    return NextResponse.json({ error: "no se pudo obtener la variante creada" }, { status: 422 });
  }

  const variantRes = await fetch(shopUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: UPDATE_VARIANT_MUTATION,
      variables: {
        productId: product.id,
        variants: [
          {
            id: variant.id,
            price: listing.price,
            inventoryItem: listing.sku ? { sku: listing.sku } : undefined,
          },
        ],
      },
    }),
  });

  const variantJson = await variantRes.json();
  const variantErrors = variantJson.data?.productVariantsBulkUpdate?.userErrors;

  if (variantJson.errors || (variantErrors && variantErrors.length > 0)) {
    return NextResponse.json(
      {
        error:
          variantJson.errors?.map((e: any) => e.message).join(", ") ||
          variantErrors.map((e: any) => e.message).join(", "),
      },
      { status: 422 }
    );
  }

  if (typeof listing.stock === "number") {
    const locationsRes = await fetch(shopUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: LOCATIONS_QUERY }),
    });
    const locationsJson = await locationsRes.json();
    const locationId = locationsJson.data?.locations?.edges?.[0]?.node?.id;

    if (locationId) {
      await fetch(shopUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: SET_INVENTORY_MUTATION,
          variables: {
            input: {
              reason: "correction",
              setQuantities: [
                {
                  inventoryItemId: variant.inventoryItem.id,
                  locationId,
                  quantity: listing.stock,
                },
              ],
            },
          },
        }),
      });
    }
  }

  let publication;
  try {
    publication = await Publication.create({
      listingId: listing._id,
      accountId: account._id,
      platform: "shopify",
      platformId: account.shopifyShopDomain,
      externalId: product.id,
      shopifyVariantId: variant.id,
      price: listing.price,
      status: mapShopifyStatus(product.status),
      publicationUrl: product.onlineStorePreviewUrl,
      syncStatus: "OK",
      lastSync: new Date(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "producto creado en Shopify pero no se pudo guardar la publicación" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, publication });
}