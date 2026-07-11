"use server";

import { revalidatePath } from "next/cache";
import connectMongo from "@/libs/mongoose";
import Account from "@/models/Account";
import Publication from "@/models/Publication";
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

  const account = await Account.findOne({ _id: accountId, userId });
  if (!account) return;

  await Publication.deleteMany({ accountId: account._id });
  await Account.deleteOne({ _id: account._id });

  revalidatePath("/settings/accounts");
}