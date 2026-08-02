import { NextRequest, NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Account from "@/models/Account";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import { getEbayUserIdentity } from "@/libs/ebay/client";
import { getValidEbayAccessToken } from "@/libs/ebay/account-token";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  let accountId: string | undefined;
  try {
    const body = await req.json();
    accountId = body.accountId;
  } catch {
    return NextResponse.json({ error: "accountId requerido" }, { status: 400 });
  }

  if (!accountId) {
    return NextResponse.json({ error: "accountId requerido" }, { status: 400 });
  }

  await connectMongo();
  const account = await Account.findOne({
    _id: accountId,
    userId,
    platform: "ebay",
  });

  if (!account) {
    return NextResponse.json({ error: "cuenta no encontrada" }, { status: 404 });
  }

  try {
    const accessToken = await getValidEbayAccessToken(account);
    const identity = await getEbayUserIdentity(accessToken);

    await Account.findByIdAndUpdate(account._id, {
      accountName: identity.username,
      syncStatus: "connected",
      lastSync: new Date(),
    });

    return NextResponse.json({
      ok: true,
      message: "Cuenta de eBay sincronizada correctamente",
    });
  } catch (err) {
    console.error("eBay sync error:", err);
    await Account.findByIdAndUpdate(account._id, {
      syncStatus: "ACCOUNT_NOT_FOUND",
    });

    return NextResponse.json(
      {
        ok: false,
        message:
          "No se pudo sincronizar la cuenta de eBay. Vuelve a conectarla desde Añadir cuenta.",
      },
      { status: 400 }
    );
  }
}
