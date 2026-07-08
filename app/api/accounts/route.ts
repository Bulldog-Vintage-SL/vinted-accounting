import { NextRequest, NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Account from "@/models/Account";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get("platform");
    if (!platform) {
      return NextResponse.json(
        { error: "Falta el parámetro 'platform'" },
        { status: 400 }
      );
    }

    await connectMongo();
    const data = await Account.find({ userId, platform }).sort({ lastSync: -1 });

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error obteniendo cuentas:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 400 }
    );
  }
}
