import { NextRequest, NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Publication from "@/models/Publication";
import Account from "@/models/Account";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";

const GET_PRODUCT_QUERY = `
  query GetProduct($id: ID!) {
    product(id: $id) {
      id
      title
      descriptionHtml
      vendor
      productType
      tags
      status
      variants(first: 1) {
        nodes {
          id
          price
          sku
        }
      }
    }
  }
`;

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const publicationId = req.nextUrl.searchParams.get("publicationId");
  if (!publicationId) {
    return NextResponse.json({ error: "falta publicationId" }, { status: 400 });
  }

  await connectMongo();

  const publication = await Publication.findOne({
    _id: publicationId,
    platform: "shopify",
  });

  if (!publication) {
    return NextResponse.json({ error: "publicación no encontrada" }, { status: 404 });
  }

  const account = await Account.findOne({
    _id: publication.accountId,
    userId,
    platform: "shopify",
  });

  if (!account) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  if (!account.shopifyShopDomain || !account.shopifyAccessToken) {
    return NextResponse.json(
      { error: "cuenta de Shopify incompleta" },
      { status: 400 }
    );
  }

  const res = await fetch(
    `https://${account.shopifyShopDomain}/admin/api/2026-07/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": account.shopifyAccessToken,
      },
      body: JSON.stringify({
        query: GET_PRODUCT_QUERY,
        variables: { id: publication.externalId },
      }),
    }
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: `Shopify API respondió ${res.status}` },
      { status: 502 }
    );
  }

  const json = await res.json();

  if (json.errors || !json.data?.product) {
    return NextResponse.json(
      {
        error:
          json.errors?.map((e: any) => e.message).join(", ") ||
          "producto no encontrado en Shopify",
      },
      { status: 404 }
    );
  }

  const product = json.data.product;
  const variant = product.variants.nodes[0];

  return NextResponse.json({
    ok: true,
    product: {
      title: product.title,
      descriptionHtml: product.descriptionHtml,
      vendor: product.vendor,
      productType: product.productType,
      tags: product.tags,
      status: product.status,
      price: variant?.price ?? "",
      sku: variant?.sku ?? "",
      variantId: variant?.id ?? null,
    },
  });
}