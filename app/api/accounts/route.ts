import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/libs/supabase/admin";
import { getAuthenticatedProfileId } from "@/libs/accounts/get-profile-id";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const profileId = await getAuthenticatedProfileId();

    if (!profileId) {
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

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("profile_id", profileId)
      .eq("platform", platform)
      .order("last_sync", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error obteniendo cuentas:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 400 }
    );
  }
}
