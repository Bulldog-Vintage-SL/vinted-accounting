import connectMongo from "@/libs/mongoose";
import Account from "@/models/Account";
import type { IAccount } from "@/models/Account";
import { getValidEbayAccessToken } from "@/libs/ebay/account-token";
import { getEbayMarketplaceId, hasEbaySellAccountScope } from "@/libs/ebay/client";
import { EbayApiError } from "@/libs/ebay/api";

export interface EbayAccountContext {
  account: IAccount;
  accessToken: string;
}

export class EbayPoliciesPermissionError extends Error {
  constructor() {
    super(
      "Tu cuenta de eBay no tiene permisos para gestionar políticas de venta (sell.account). " +
        "Pulsa Reconectar en Ajustes → Cuentas vinculadas. Si sigue fallando, activa el scope " +
        "sell.account en developer.ebay.com para tu app sandbox. " +
        "Alternativa: configura EBAY_FULFILLMENT_POLICY_ID, EBAY_PAYMENT_POLICY_ID, " +
        "EBAY_RETURN_POLICY_ID y EBAY_MERCHANT_LOCATION_KEY en el servidor."
    );
    this.name = "EbayPoliciesPermissionError";
  }
}

export async function getEbayAccountContext(
  accountId: string,
  userId: string
): Promise<EbayAccountContext> {
  await connectMongo();
  const account = await Account.findOne({
    _id: accountId,
    userId,
    platform: "ebay",
  });

  if (!account) {
    throw new Error("cuenta de eBay no encontrada");
  }

  const accessToken = await getValidEbayAccessToken(account);
  return { account, accessToken };
}

export interface EbayListingPolicies {
  marketplaceId: string;
  merchantLocationKey: string;
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
}

interface PolicyListResponse {
  fulfillmentPolicies?: { fulfillmentPolicyId: string }[];
  paymentPolicies?: { paymentPolicyId: string }[];
  returnPolicies?: { returnPolicyId: string }[];
}

interface LocationListResponse {
  locations?: { merchantLocationKey: string }[];
}

function firstId(
  items: { [key: string]: string }[] | undefined,
  key: string
): string | null {
  const id = items?.[0]?.[key];
  return typeof id === "string" && id ? id : null;
}

function policiesFromEnv(marketplaceId: string): Partial<EbayListingPolicies> {
  return {
    marketplaceId,
    merchantLocationKey: process.env.EBAY_MERCHANT_LOCATION_KEY,
    fulfillmentPolicyId: process.env.EBAY_FULFILLMENT_POLICY_ID,
    paymentPolicyId: process.env.EBAY_PAYMENT_POLICY_ID,
    returnPolicyId: process.env.EBAY_RETURN_POLICY_ID,
  };
}

function hasEnvPolicies(marketplaceId: string): boolean {
  const env = policiesFromEnv(marketplaceId);
  return Boolean(
    env.merchantLocationKey &&
      env.fulfillmentPolicyId &&
      env.paymentPolicyId &&
      env.returnPolicyId
  );
}

/** Tokens issued before sell.account was added cannot read/create listing policies. */
export function accountMissingEbayPolicyScope(account: IAccount): boolean {
  if (hasEbaySellAccountScope(account.ebayScopes)) return false;
  if (!account.ebayScopes) return false;
  return true;
}

function assertEbayPolicyAccess(account: IAccount, marketplaceId: string) {
  const cachedOnAccount = Boolean(
    account.ebayMerchantLocationKey &&
      account.ebayFulfillmentPolicyId &&
      account.ebayPaymentPolicyId &&
      account.ebayReturnPolicyId
  );
  if (cachedOnAccount || hasEnvPolicies(marketplaceId)) return;

  if (accountMissingEbayPolicyScope(account)) {
    throw new EbayPoliciesPermissionError();
  }
}

async function ensureMerchantLocation(
  accessToken: string,
  account: IAccount,
  existingKey?: string | null
): Promise<string> {
  if (existingKey) return existingKey;

  const { ebayApiRequest } = await import("@/libs/ebay/api");

  try {
    const locations = await ebayApiRequest<LocationListResponse>(
      accessToken,
      "GET",
      "/sell/inventory/v1/location?limit=1"
    );
    const found = firstId(
      locations.locations as { merchantLocationKey: string }[] | undefined,
      "merchantLocationKey"
    );
    if (found) return found;
  } catch (err) {
    if (err instanceof EbayApiError && err.status === 403) {
      throw new EbayPoliciesPermissionError();
    }
    throw err;
  }

  const merchantLocationKey = `RL-${account._id?.toString().slice(-8)}`;
  await ebayApiRequest(accessToken, "POST", "/sell/inventory/v1/location", {
    location: {
      address: {
        addressLine1: "Calle Principal 1",
        city: "Madrid",
        postalCode: "28001",
        country: "ES",
      },
    },
    locationTypes: ["WAREHOUSE"],
    merchantLocationKey,
    name: "Reventa Libertad",
  });

  return merchantLocationKey;
}

async function fetchAccountPolicies(
  accessToken: string,
  marketplaceId: string
): Promise<{
  fulfillmentPolicyId: string | null;
  paymentPolicyId: string | null;
  returnPolicyId: string | null;
}> {
  const { ebayApiRequest } = await import("@/libs/ebay/api");

  try {
    const [fulfillment, payment, returns] = await Promise.all([
      ebayApiRequest<PolicyListResponse>(
        accessToken,
        "GET",
        `/sell/account/v1/fulfillment_policy?marketplace_id=${marketplaceId}`
      ),
      ebayApiRequest<PolicyListResponse>(
        accessToken,
        "GET",
        `/sell/account/v1/payment_policy?marketplace_id=${marketplaceId}`
      ),
      ebayApiRequest<PolicyListResponse>(
        accessToken,
        "GET",
        `/sell/account/v1/return_policy?marketplace_id=${marketplaceId}`
      ),
    ]);

    return {
      fulfillmentPolicyId: firstId(
        fulfillment.fulfillmentPolicies as { fulfillmentPolicyId: string }[] | undefined,
        "fulfillmentPolicyId"
      ),
      paymentPolicyId: firstId(
        payment.paymentPolicies as { paymentPolicyId: string }[] | undefined,
        "paymentPolicyId"
      ),
      returnPolicyId: firstId(
        returns.returnPolicies as { returnPolicyId: string }[] | undefined,
        "returnPolicyId"
      ),
    };
  } catch (err) {
    if (err instanceof EbayApiError && err.status === 403) {
      throw new EbayPoliciesPermissionError();
    }
    throw err;
  }
}

async function createMissingPolicies(
  accessToken: string,
  marketplaceId: string,
  current: {
    fulfillmentPolicyId: string | null;
    paymentPolicyId: string | null;
    returnPolicyId: string | null;
  }
) {
  const { ebayApiRequest } = await import("@/libs/ebay/api");

  let { fulfillmentPolicyId, paymentPolicyId, returnPolicyId } = current;

  try {
    if (!fulfillmentPolicyId) {
      const created = await ebayApiRequest<{ fulfillmentPolicyId: string }>(
        accessToken,
        "POST",
        "/sell/account/v1/fulfillment_policy",
        {
          name: "Reventa Libertad Envío",
          marketplaceId,
          categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES", default: true }],
          handlingTime: { value: 1, unit: "DAY" },
          shippingOptions: [
            {
              optionType: "DOMESTIC",
              costType: "FLAT_RATE",
              shippingServices: [
                {
                  sortOrder: 1,
                  shippingCarrierCode: "OTHER",
                  shippingServiceCode: "ES_StandardShipping",
                  shippingCost: { value: "4.99", currency: "EUR" },
                },
              ],
            },
          ],
        }
      );
      fulfillmentPolicyId = created.fulfillmentPolicyId;
    }

    if (!paymentPolicyId) {
      const created = await ebayApiRequest<{ paymentPolicyId: string }>(
        accessToken,
        "POST",
        "/sell/account/v1/payment_policy",
        {
          name: "Reventa Libertad Pago",
          marketplaceId,
          categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES", default: true }],
          immediatePay: false,
        }
      );
      paymentPolicyId = created.paymentPolicyId;
    }

    if (!returnPolicyId) {
      const created = await ebayApiRequest<{ returnPolicyId: string }>(
        accessToken,
        "POST",
        "/sell/account/v1/return_policy",
        {
          name: "Reventa Libertad Devoluciones",
          marketplaceId,
          categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES", default: true }],
          returnsAccepted: true,
          returnPeriod: { value: 14, unit: "DAY" },
          refundMethod: "MONEY_BACK",
          returnShippingCostPayer: "BUYER",
        }
      );
      returnPolicyId = created.returnPolicyId;
    }
  } catch (err) {
    if (err instanceof EbayApiError && err.status === 403) {
      throw new EbayPoliciesPermissionError();
    }
    throw err;
  }

  return { fulfillmentPolicyId, paymentPolicyId, returnPolicyId };
}

export async function ensureEbayListingPolicies(
  account: IAccount,
  accessToken: string
): Promise<EbayListingPolicies> {
  const marketplaceId =
    account.ebayMarketplaceId || getEbayMarketplaceId();

  assertEbayPolicyAccess(account, marketplaceId);

  if (
    account.ebayMerchantLocationKey &&
    account.ebayFulfillmentPolicyId &&
    account.ebayPaymentPolicyId &&
    account.ebayReturnPolicyId
  ) {
    return {
      marketplaceId,
      merchantLocationKey: account.ebayMerchantLocationKey,
      fulfillmentPolicyId: account.ebayFulfillmentPolicyId,
      paymentPolicyId: account.ebayPaymentPolicyId,
      returnPolicyId: account.ebayReturnPolicyId,
    };
  }

  const envPolicies = policiesFromEnv(marketplaceId);
  let fulfillmentPolicyId =
    account.ebayFulfillmentPolicyId || envPolicies.fulfillmentPolicyId || null;
  let paymentPolicyId =
    account.ebayPaymentPolicyId || envPolicies.paymentPolicyId || null;
  let returnPolicyId =
    account.ebayReturnPolicyId || envPolicies.returnPolicyId || null;
  let merchantLocationKey =
    account.ebayMerchantLocationKey || envPolicies.merchantLocationKey || null;

  if (!fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
    const fetched = await fetchAccountPolicies(accessToken, marketplaceId);
    fulfillmentPolicyId = fulfillmentPolicyId || fetched.fulfillmentPolicyId;
    paymentPolicyId = paymentPolicyId || fetched.paymentPolicyId;
    returnPolicyId = returnPolicyId || fetched.returnPolicyId;

    const created = await createMissingPolicies(accessToken, marketplaceId, {
      fulfillmentPolicyId,
      paymentPolicyId,
      returnPolicyId,
    });
    fulfillmentPolicyId = created.fulfillmentPolicyId;
    paymentPolicyId = created.paymentPolicyId;
    returnPolicyId = created.returnPolicyId;
  }

  merchantLocationKey = await ensureMerchantLocation(
    accessToken,
    account,
    merchantLocationKey
  );

  const policies: EbayListingPolicies = {
    marketplaceId,
    merchantLocationKey,
    fulfillmentPolicyId: fulfillmentPolicyId!,
    paymentPolicyId: paymentPolicyId!,
    returnPolicyId: returnPolicyId!,
  };

  await Account.findByIdAndUpdate(account._id, {
    ebayMarketplaceId: marketplaceId,
    ebayMerchantLocationKey: policies.merchantLocationKey,
    ebayFulfillmentPolicyId: policies.fulfillmentPolicyId,
    ebayPaymentPolicyId: policies.paymentPolicyId,
    ebayReturnPolicyId: policies.returnPolicyId,
  });

  return policies;
}
