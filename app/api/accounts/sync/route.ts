import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Account from "@/models/Account";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json();
  const { externalId, syncStatus, platform } = body;

  if (!externalId || !syncStatus || !platform) {
    return NextResponse.json(
      { status: "error", message: "Falta algun parametro" },
      { status: 400 }
    );
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json(
      { status: "error", message: "Error autenticando al usuario" },
      { status: 401 }
    );
  }

  await connectMongo();
  const account = await Account.findOneAndUpdate(
    { externalId: String(externalId), platform, userId },
    {
      syncStatus,
      lastSync: new Date(),
    },
    { new: true }
  );

  if (!account) {
    return NextResponse.json(
      { status: "error", message: "Cuenta no encontrada" },
      { status: 404 }
    );
  }

  if (syncStatus === "OK") {
    return NextResponse.json(
      { status: "success", message: "Cuenta sincronizada con éxito" },
      { status: 200 }
    );
  }

  if (syncStatus === "ACCOUNT_NOT_FOUND") {
    return NextResponse.json(
      { status: "failure", message: "Cuenta no activa" },
      { status: 200 }
    );
  }

  return NextResponse.json({ status: "success", message: "Estado actualizado" });
}
