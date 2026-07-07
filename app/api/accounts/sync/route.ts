import { NextResponse } from "next/server";
import { createAdminClient } from "@/libs/supabase/admin";
import { getAuthenticatedProfileId } from "@/libs/accounts/get-profile-id";

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

  const profileId = await getAuthenticatedProfileId();
  if (!profileId) {
    return NextResponse.json(
      { status: "error", message: "Error autenticando al usuario" },
      { status: 401 }
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("accounts")
    .update({
      sync_status: syncStatus,
      last_sync: new Date().toISOString(),
    })
    .eq("external_id", String(externalId))
    .eq("platform", platform)
    .eq("profile_id", profileId)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { status: "error", message: "Base de datos: " + error.message },
      { status: 400 }
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
