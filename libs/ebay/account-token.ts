import connectMongo from "@/libs/mongoose";
import Account from "@/models/Account";
import type { IAccount } from "@/models/Account";
import {
  refreshEbayAccessToken,
  getEbayTokenExpiryDate,
} from "@/libs/ebay/client";

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

export async function getValidEbayAccessToken(
  account: Pick<
    IAccount,
    "_id" | "ebayAccessToken" | "ebayRefreshToken" | "ebayTokenExpiresAt"
  >
): Promise<string> {
  const expiresAt = account.ebayTokenExpiresAt
    ? new Date(account.ebayTokenExpiresAt).getTime()
    : 0;
  const needsRefresh =
    !account.ebayAccessToken ||
    Date.now() >= expiresAt - REFRESH_BUFFER_MS;

  if (!needsRefresh && account.ebayAccessToken) {
    return account.ebayAccessToken;
  }

  if (!account.ebayRefreshToken) {
    throw new Error("Missing eBay refresh token");
  }

  const tokens = await refreshEbayAccessToken(account.ebayRefreshToken);

  await connectMongo();
  await Account.findByIdAndUpdate(account._id, {
    ebayAccessToken: tokens.access_token,
    ebayRefreshToken: tokens.refresh_token ?? account.ebayRefreshToken,
    ebayTokenExpiresAt: getEbayTokenExpiryDate(tokens.expires_in),
    syncStatus: "connected",
    lastSync: new Date(),
  });

  return tokens.access_token;
}
