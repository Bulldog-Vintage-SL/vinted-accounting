import connectMongo from "@/libs/mongoose";
import Account from "@/models/Account";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import mongoose from "mongoose";

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
  if (!accountData?.externalId) {
    return Response.json(
      { status: "error", message: "No se ha encontrado una cuenta activa" },
      { status: 400 }
    );
  }

  try {
    await connectMongo();
    const existing = await Account.findOne({
      externalId: String(accountData.externalId),
      platform: "vestiaire",
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
      externalId: String(accountData.externalId),
      platform: "vestiaire",
      syncStatus: "OK",
      vestiaireId: accountData.vestiaireId
        ? String(accountData.vestiaireId)
        : null,
      lastSync: new Date(),
      profileLink: accountData.profileLink ?? null,
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
