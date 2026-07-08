import { NextRequest, NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Publication from "@/models/Publication";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";

export const dynamic = "force-dynamic";

const DELETE_PRODUCT_MUTATION = `
  mutation DeleteProduct($input: ProductDeleteInput!) {
    productDelete(input: $input) {
      deletedProductId
      userErrors {
        field
        message
      }
    }
  }
`;

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { publicationId } = await req.json();
  if (!publicationId) {
    return NextResponse.json({ error: "falta publicationId" }, { status: 400 });
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
        query: DELETE_PRODUCT_MUTATION,
        variables: { input: { id: publication.externalId } },
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
  if (json.errors) {
    return NextResponse.json(
      { error: json.errors.map((e: any) => e.message).join(", ") },
      { status: 502 }
    );
  }

  const userErrors = json.data?.productDelete?.userErrors;
  if (userErrors && userErrors.length > 0) {
    const notFound = userErrors.some((e: any) =>
      e.message?.toLowerCase().includes("does not exist")
    );
    if (!notFound) {
      return NextResponse.json(
        { error: userErrors.map((e: any) => e.message).join(", ") },
        { status: 422 }
      );
    }
  }

  await Publication.deleteOne({ _id: publicationId });

  return NextResponse.json({
    ok: true,
    deletedExternalId: publication.externalId,
  });
}
