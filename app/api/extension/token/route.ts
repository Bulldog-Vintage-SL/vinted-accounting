import { NextResponse } from "next/server";
import { createExtensionToken } from "@/libs/extension-auth";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  return NextResponse.json({ token: createExtensionToken(userId) });
}
