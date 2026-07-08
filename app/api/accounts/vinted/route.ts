import connectMongo from "@/libs/mongoose";
import Account from "@/models/Account";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

async function upsertPlatformAccount(
  userId: string,
  platform: string,
  accountData: {
    externalId: string;
    profileLink?: string;
    accountName?: string;
    vestiaireId?: string;
  }
) {
  await connectMongo();

  const existing = await Account.findOne({
    externalId: String(accountData.externalId),
    platform,
    userId,
  });

  if (existing) {
    existing.syncStatus = "OK";
    existing.lastSync = new Date();
    if (accountData.profileLink) existing.profileLink = accountData.profileLink;
    if (accountData.accountName) existing.accountName = accountData.accountName;
    await existing.save();
    return { status: "success", message: "Cuenta sincronizada con éxito" };
  }

  await Account.create({
    userId: new mongoose.Types.ObjectId(userId),
    externalId: String(accountData.externalId),
    platform,
    syncStatus: "OK",
    lastSync: new Date(),
    profileLink: accountData.profileLink ?? null,
    accountName: accountData.accountName ?? null,
    vestiaireId: accountData.vestiaireId ?? null,
  });

  return { status: "success", message: "Nueva cuenta registrada con éxito" };
}

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
    const result = await upsertPlatformAccount(userId, "vinted", accountData);
    return Response.json(result, { status: 200 });
  } catch (error: any) {
    return Response.json(
      { status: "error", message: "Base de datos: " + error.message },
      { status: 400 }
    );
  }
}
