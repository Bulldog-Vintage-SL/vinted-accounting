import { createAdminClient } from "@/libs/supabase/admin";
import { getAuthenticatedProfileId } from "@/libs/accounts/get-profile-id";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const profileId = await getAuthenticatedProfileId();
  if (!profileId) {
    return Response.json(
      { status: "error", message: "Error autenticando al usuario" },
      { status: 401 }
    );
  }

  const accountData = await req.json();

  if (!accountData || !accountData.externalId) {
    return Response.json(
      { status: "error", message: "No se ha encontrado una cuenta activa" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("accounts")
    .select("*")
    .eq("external_id", String(accountData.externalId))
    .eq("platform", "wallapop")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("accounts")
      .update({
        last_sync: new Date().toISOString(),
        sync_status: "OK",
      })
      .eq("id", existing.id);

    if (error) {
      return Response.json(
        { status: "error", message: "Base de datos: " + error.message },
        { status: 400 }
      );
    }

    return Response.json(
      { status: "success", message: "Cuenta sincronizada con éxito" },
      { status: 200 }
    );
  }

  const { error } = await supabase.from("accounts").insert({
    external_id: String(accountData.externalId),
    platform: "wallapop",
    sync_status: "OK",
    last_sync: new Date().toISOString(),
    profile_link: accountData.profileLink,
    account_name: accountData.accountName,
    profile_id: profileId,
  });

  if (error) {
    return Response.json(
      { status: "error", message: "Base de datos: " + error.message },
      { status: 400 }
    );
  }

  return Response.json(
    { status: "success", message: "Nueva cuenta registrada con éxito" },
    { status: 200 }
  );
}
