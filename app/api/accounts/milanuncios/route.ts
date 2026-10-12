import connectMongo from "@/libs/mongoose";
import Account from "@/models/Account";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import mongoose from "mongoose";
import { normalizeMilanunciosUserId } from "@/lib/workflows/milanuncios/milanuncios-mapper";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return Response.json(
      { status: "error", message: "Error autenticando al usuario" },
      { status: 401 }
    );
  }

  const accountData = await req.json();
  const externalId =
    normalizeMilanunciosUserId(accountData?.externalId) ||
    (accountData?.externalId != null ? String(accountData.externalId) : null);
  if (!externalId) {
    return Response.json(
      { status: "error", message: "No se ha encontrado una cuenta activa" },
      { status: 400 }
    );
  }

  try {
    await connectMongo();
    // Limpia cuentas previas guardadas con el id Segment (sdrn:...).
    await Account.deleteMany({
      userId,
      platform: "milanuncios",
      externalId: { $regex: /^sdrn:/i },
    });

    const existing = await Account.findOne({
      externalId,
      platform: "milanuncios",
      userId,
    });

    if (existing) {
      existing.syncStatus = "OK";
      existing.lastSync = new Date();
      if (accountData.profileLink) existing.profileLink = accountData.profileLink;
      if (accountData.accountName) existing.accountName = accountData.accountName;
      await existing.save();
      return Response.json(
        { status: "success", message: "Cuenta sincronizada con éxito" },
        { status: 200 }
      );
    }

    await Account.create({
      userId: new mongoose.Types.ObjectId(userId),
      externalId,
      platform: "milanuncios",
      syncStatus: "OK",
      lastSync: new Date(),
      profileLink: accountData.profileLink ?? `https://www.milanuncios.com/usuario/${externalId}`,
      accountName: accountData.accountName ?? null,
    });

    return Response.json(
      { status: "success", message: "Nueva cuenta registrada con éxito" },
      { status: 200 }
    );
  } catch (error: any) {
    return Response.json(
      { status: "error", message: "Base de datos: " + error.message },
      { status: 400 }
    );
  }
}
