"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/libs/supabase/admin";
import { getAuthenticatedProfileId } from "@/libs/accounts/get-profile-id";

export async function startAccountSearch(_platform: string) {
  revalidatePath("/settings/accounts");
}

export async function syncAccount(_accountId: string) {
  revalidatePath("/settings/accounts");
}

export async function deleteAccount(accountId: string) {
  const profileId = await getAuthenticatedProfileId();
  if (!profileId) return;

  const supabase = createAdminClient();
  await supabase
    .from("accounts")
    .delete()
    .eq("id", accountId)
    .eq("profile_id", profileId);

  revalidatePath("/settings/accounts");
}
