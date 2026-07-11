import { NextRequest } from "next/server";
import { signIn } from "@/libs/next-auth";
import config from "@/config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const callbackUrl =
    req.nextUrl.searchParams.get("callbackUrl") ?? config.auth.callbackUrl;

  await signIn("google", { redirectTo: callbackUrl });
}
