import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Account from "@/models/Account";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import {
  ensureEbayListingPolicies,
  getEbayAccountContext,
  EbayPoliciesPermissionError,
} from "@/libs/ebay/policies";

export const dynamic = "force-dynamic";

/** Intenta resolver y cachear políticas de eBay tras reconectar la cuenta. */
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
    const { account, accessToken } = await getEbayAccountContext(
      accountId,
      userId
    );
    const policies = await ensureEbayListingPolicies(account, accessToken);

    await connectMongo();
    const updated = await Account.findById(account._id);

    return NextResponse.json({
      ok: true,
      message: "Políticas de eBay configuradas correctamente",
      policies: {
        marketplaceId: policies.marketplaceId,
        merchantLocationKey: policies.merchantLocationKey,
        fulfillmentPolicyId: policies.fulfillmentPolicyId,
        paymentPolicyId: policies.paymentPolicyId,
        returnPolicyId: policies.returnPolicyId,
        cachedOnAccount: Boolean(updated?.ebayFulfillmentPolicyId),
      },
    });
  } catch (err) {
    if (err instanceof EbayPoliciesPermissionError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }

    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Error configurando políticas",
      },
      { status: 502 }
    );
  }
}
