import { createAdminClient } from "@/libs/supabase/admin";
import { getAuthenticatedProfileId } from "@/libs/accounts/get-profile-id";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profileId = await getAuthenticatedProfileId();

  if (!profileId) {
    return Response.json({ error: "No user" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id)
    .eq("profile_id", profileId)
    .single();

  if (error) {
    return Response.json({ error }, { status: 400 });
  }

  return Response.json(data);
}
