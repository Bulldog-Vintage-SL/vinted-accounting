import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Account from "@/models/Account";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import { getEbayAccountContext } from "@/libs/ebay/policies";
import { getEbayMarketplaceId } from "@/libs/ebay/client";
import { ebayApiRequest, EbayApiError } from "@/libs/ebay/api";

export const dynamic = "force-dynamic";

interface PolicyListResponse {
  fulfillmentPolicies?: { fulfillmentPolicyId: string; name?: string }[];
  paymentPolicies?: { paymentPolicyId: string; name?: string }[];
  returnPolicies?: { returnPolicyId: string; name?: string }[];
}

interface LocationListResponse {
  locations?: { merchantLocationKey: string; name?: string }[];
}

/** Lists eBay business policies and inventory locations for the connected account. */
export async function POST(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  let accountId: string | undefined;
  try {
    const body = await req.json();
    accountId = body.accountId;
  } catch {
    return NextResponse.json({ error: "accountId requerido" }, { status: 400 });
  }

  if (!accountId) {
    return NextResponse.json({ error: "accountId requerido" }, { status: 400 });
  }

  try {
    const { account, accessToken } = await getEbayAccountContext(accountId, userId);
    const marketplaceId = account.ebayMarketplaceId || getEbayMarketplaceId();

    const results: Record<string, unknown> = {
      ok: true,
      marketplaceId,
      accountName: account.accountName,
      ebayScopes: account.ebayScopes ?? null,
      cachedOnAccount: {
        fulfillmentPolicyId: account.ebayFulfillmentPolicyId ?? null,
        paymentPolicyId: account.ebayPaymentPolicyId ?? null,
        returnPolicyId: account.ebayReturnPolicyId ?? null,
        merchantLocationKey: account.ebayMerchantLocationKey ?? null,
      },
      envConfigured: {
        fulfillmentPolicyId: Boolean(process.env.EBAY_FULFILLMENT_POLICY_ID),
        paymentPolicyId: Boolean(process.env.EBAY_PAYMENT_POLICY_ID),
        returnPolicyId: Boolean(process.env.EBAY_RETURN_POLICY_ID),
        merchantLocationKey: Boolean(process.env.EBAY_MERCHANT_LOCATION_KEY),
      },
    };

    const errors: Record<string, string> = {};

    try {
      const fulfillment = await ebayApiRequest<PolicyListResponse>(
        accessToken,
        "GET",
        `/sell/account/v1/fulfillment_policy?marketplace_id=${marketplaceId}`
      );
      results.fulfillmentPolicies = fulfillment.fulfillmentPolicies ?? [];
    } catch (err) {
      errors.fulfillment =
        err instanceof EbayApiError
          ? `${err.status}: ${err.body.slice(0, 300)}`
          : err instanceof Error
            ? err.message
            : "unknown";
    }

    try {
      const payment = await ebayApiRequest<PolicyListResponse>(
        accessToken,
        "GET",
        `/sell/account/v1/payment_policy?marketplace_id=${marketplaceId}`
      );
      results.paymentPolicies = payment.paymentPolicies ?? [];
    } catch (err) {
      errors.payment =
        err instanceof EbayApiError
          ? `${err.status}: ${err.body.slice(0, 300)}`
          : err instanceof Error
            ? err.message
            : "unknown";
    }

    try {
      const returns = await ebayApiRequest<PolicyListResponse>(
        accessToken,
        "GET",
        `/sell/account/v1/return_policy?marketplace_id=${marketplaceId}`
      );
      results.returnPolicies = returns.returnPolicies ?? [];
    } catch (err) {
      errors.return =
        err instanceof EbayApiError
          ? `${err.status}: ${err.body.slice(0, 300)}`
          : err instanceof Error
            ? err.message
            : "unknown";
    }

    try {
      const locations = await ebayApiRequest<LocationListResponse>(
        accessToken,
        "GET",
        "/sell/inventory/v1/location?limit=10"
      );
      results.locations = locations.locations ?? [];
    } catch (err) {
      errors.locations =
        err instanceof EbayApiError
          ? `${err.status}: ${err.body.slice(0, 300)}`
          : err instanceof Error
            ? err.message
            : "unknown";
    }

    if (Object.keys(errors).length) {
      results.errors = errors;
    }

    const suggestedEnv: Record<string, string | null> = {
      EBAY_FULFILLMENT_POLICY_ID:
        (results.fulfillmentPolicies as { fulfillmentPolicyId: string }[] | undefined)?.[0]
          ?.fulfillmentPolicyId ?? null,
      EBAY_PAYMENT_POLICY_ID:
        (results.paymentPolicies as { paymentPolicyId: string }[] | undefined)?.[0]
          ?.paymentPolicyId ?? null,
      EBAY_RETURN_POLICY_ID:
        (results.returnPolicies as { returnPolicyId: string }[] | undefined)?.[0]
          ?.returnPolicyId ?? null,
      EBAY_MERCHANT_LOCATION_KEY:
        (results.locations as { merchantLocationKey: string }[] | undefined)?.[0]
          ?.merchantLocationKey ?? null,
    };
    results.suggestedEnv = suggestedEnv;

    await connectMongo();
    if (
      suggestedEnv.EBAY_FULFILLMENT_POLICY_ID &&
      suggestedEnv.EBAY_PAYMENT_POLICY_ID &&
      suggestedEnv.EBAY_RETURN_POLICY_ID &&
      suggestedEnv.EBAY_MERCHANT_LOCATION_KEY
    ) {
      await Account.findByIdAndUpdate(account._id, {
        ebayMarketplaceId: marketplaceId,
        ebayFulfillmentPolicyId: suggestedEnv.EBAY_FULFILLMENT_POLICY_ID,
        ebayPaymentPolicyId: suggestedEnv.EBAY_PAYMENT_POLICY_ID,
        ebayReturnPolicyId: suggestedEnv.EBAY_RETURN_POLICY_ID,
        ebayMerchantLocationKey: suggestedEnv.EBAY_MERCHANT_LOCATION_KEY,
      });
      results.cachedToAccount = true;
    }

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Error listando políticas",
      },
      { status: 502 }
    );
  }
}
