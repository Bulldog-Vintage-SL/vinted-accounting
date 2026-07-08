"use server";

import { revalidatePath } from "next/cache";
import connectMongo from "@/libs/mongoose";
import Account from "@/models/Account";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";

export async function startAccountSearch(_platform: string) {
  revalidatePath("/settings/accounts");
}

export async function syncAccount(_accountId: string) {
  revalidatePath("/settings/accounts");
}

export async function deleteAccount(accountId: string) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return;

  await connectMongo();
  await Account.deleteOne({ _id: accountId, userId });
  revalidatePath("/settings/accounts");
}
