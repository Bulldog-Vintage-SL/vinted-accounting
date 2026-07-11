import { NextRequest, NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Listing from "@/models/Listing";
import Publication from "@/models/Publication";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";

const UPDATE_PRODUCT_MUTATION = `
  mutation UpdateProduct($product: ProductUpdateInput!) {
    productUpdate(product: $product) {
      product { id status }
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

  const { publicationId, fields } = await req.json();
  if (!publicationId || !fields) {
    return NextResponse.json({ error: "faltan parámetros" }, { status: 400 });
  }

  await connectMongo();

  const publication = await Publication.findOne({
    _id: publicationId,
    platform: "shopify",
  }).populate("accountId");

  if (!publication) {
    return NextResponse.json({ error: "publicación no encontrada" }, { status: 404 });
  }

  const account = publication.accountId as any;

  if (!account || account.userId?.toString() !== userId) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const shopUrl = `https://${account.shopifyShopDomain}/admin/api/2026-07/graphql.json`;
  const headers = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": account.shopifyAccessToken,
  };

  const productRes = await fetch(shopUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: UPDATE_PRODUCT_MUTATION,
      variables: {
        product: {
          id: publication.externalId,
          title: fields.title,
          descriptionHtml: fields.description,
          vendor: fields.vendor,
          productType: fields.productType,
          tags: fields.tags,
          status: fields.status,
        },
      },
    }),
  });

  const productJson = await productRes.json();
  const productErrors = productJson.data?.productUpdate?.userErrors;

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

  if (publication.shopifyVariantId) {
    const variantRes = await fetch(shopUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: UPDATE_VARIANT_MUTATION,
        variables: {
          productId: publication.externalId,
          variants: [
            {
              id: publication.shopifyVariantId,
              price: fields.price,
              inventoryItem: fields.sku ? { sku: fields.sku } : undefined,
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
  }

  await Listing.findByIdAndUpdate(publication.listingId, {
    title: fields.title,
    description: fields.description,
    price: parseFloat(fields.price),
    sku: fields.sku || null,
    tags: fields.tags,
    status: mapShopifyStatus(fields.status),
    lastUpdate: new Date(),
  });

  await Publication.findByIdAndUpdate(publication._id, {
    price: parseFloat(fields.price),
    status: mapShopifyStatus(fields.status),
    lastSync: new Date(),
  });

  return NextResponse.json({ ok: true });
}