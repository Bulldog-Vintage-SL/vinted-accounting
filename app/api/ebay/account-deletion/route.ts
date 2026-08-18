import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Account from "@/models/Account";
import Publication from "@/models/Publication";
import { getAppUrl } from "@/libs/app-url";

export const dynamic = "force-dynamic";

/**
 * eBay Marketplace Account Deletion / Closure notifications.
 * Required to unlock / keep compliant production App Keys.
 *
 * Portal fields must match env exactly:
 * - Endpoint URL  → EBAY_ACCOUNT_DELETION_ENDPOINT_URL
 * - Verification token → EBAY_ACCOUNT_DELETION_VERIFICATION_TOKEN (32–80 chars: [A-Za-z0-9_-])
 *
 * Docs: https://developer.ebay.com/marketplace-account-deletion
 */

function getVerificationToken(): string {
  const token = process.env.EBAY_ACCOUNT_DELETION_VERIFICATION_TOKEN?.trim();
  if (!token) {
    throw new Error("EBAY_ACCOUNT_DELETION_VERIFICATION_TOKEN is not configured");
  }
  if (token.length < 32 || token.length > 80) {
    throw new Error(
      "EBAY_ACCOUNT_DELETION_VERIFICATION_TOKEN must be 32–80 characters"
    );
  }
  return token;
}

/** Must be byte-for-byte identical to the URL saved in the eBay Developer Portal. */
function getEndpointUrl(): string {
  const configured = process.env.EBAY_ACCOUNT_DELETION_ENDPOINT_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return `${getAppUrl()}/api/ebay/account-deletion`;
}

/** GET: eBay challenge to prove you own the endpoint. */
export async function GET(req: NextRequest) {
  const challengeCode = req.nextUrl.searchParams.get("challenge_code");
  if (!challengeCode) {
    return NextResponse.json(
      { error: "missing challenge_code" },
      { status: 400 }
    );
  }

  try {
    const verificationToken = getVerificationToken();
    const endpoint = getEndpointUrl();

    // Order is mandatory: challengeCode + verificationToken + endpointURL
    const challengeResponse = createHash("sha256")
      .update(challengeCode + verificationToken + endpoint)
      .digest("hex");

    return NextResponse.json(
      { challengeResponse },
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("eBay account-deletion challenge error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "challenge failed" },
      { status: 500 }
    );
  }
}

interface DeletionNotificationBody {
  notification?: {
    data?: {
      username?: string;
      userId?: string;
      eiasToken?: string;
    };
  };
  data?: {
    username?: string;
    userId?: string;
  };
}

/**
 * POST: eBay notifies that a user requested deletion of their personal data.
 * Respond 200 quickly; purge linked eBay account data best-effort.
 */
export async function POST(req: NextRequest) {
  let body: DeletionNotificationBody = {};
  try {
    body = (await req.json()) as DeletionNotificationBody;
  } catch {
    return new NextResponse(null, { status: 200 });
  }

  try {
    const data = body.notification?.data ?? body.data ?? {};
    const userId = data.userId ? String(data.userId) : null;
    const username = data.username ? String(data.username) : null;

    if (userId || username) {
      await connectMongo();

      const or: Array<Record<string, string>> = [];
      if (userId) or.push({ externalId: userId });
      if (username) or.push({ accountName: username });

      const accounts = await Account.find({
        platform: "ebay",
        $or: or,
      });

      for (const account of accounts) {
        await Publication.deleteMany({
          accountId: account._id,
          platform: "ebay",
        });
        // Wipe OAuth tokens + account row so no personal eBay data remains
        await Account.deleteOne({ _id: account._id });
      }

      console.log(
        `eBay MARKETPLACE_ACCOUNT_DELETION processed userId=${userId} username=${username} removed=${accounts.length}`
      );
    }
  } catch (err) {
    // Still ACK so eBay stops retrying; log for follow-up
    console.error("eBay account-deletion POST processing error:", err);
  }

  return new NextResponse(null, { status: 200 });
}
