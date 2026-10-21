import connectMongo from "@/libs/mongoose";
import Account from "@/models/Account";
import { refreshTokens } from "@/libs/etsy/client";
import { encrypt, decrypt } from "@/libs/etsy/crypto";

const MARGIN_MS = 5 * 60 * 1000;

export async function getEtsyAccessToken(accountId: string) {
  await connectMongo();
  const acc = await Account.findById(accountId);
  if (!acc || acc.platform !== "etsy" || !acc.etsyAccessToken || !acc.etsyRefreshToken) {
    throw new Error("etsy_account_not_found");
  }

  const expiresAt = acc.etsyTokenExpiresAt?.getTime() ?? 0;
  if (expiresAt - Date.now() > MARGIN_MS) {
    return decrypt(acc.etsyAccessToken);
  }

  try {
    const t = await refreshTokens(decrypt(acc.etsyRefreshToken));
    acc.etsyAccessToken = encrypt(t.access_token);
    acc.etsyRefreshToken = encrypt(t.refresh_token);
    acc.etsyTokenExpiresAt = new Date(Date.now() + (t.expires_in - 60) * 1000);
    await acc.save();
    return t.access_token;
  } catch (e) {
    acc.syncStatus = "NEEDS_SYNC";
    await acc.save();
    throw e;
  }
}