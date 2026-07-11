import { NextResponse } from "next/server";
import { getAppUrl } from "@/libs/app-url";

export const dynamic = "force-dynamic";

export async function GET() {
  let mongoOk = false;

  if (process.env.MONGODB_URI) {
    try {
      const connectMongo = (await import("@/libs/mongo")).default;
      if (connectMongo) {
        const client = await connectMongo;
        await client.db().admin().ping();
        mongoOk = true;
      }
    } catch {
      mongoOk = false;
    }
  }

  return NextResponse.json({
    authUrl: process.env.NEXTAUTH_URL ?? null,
    appUrl: getAppUrl(),
    vercelUrl: process.env.VERCEL_URL ?? null,
    hasGoogleId: Boolean(process.env.GOOGLE_ID),
    hasGoogleSecret: Boolean(process.env.GOOGLE_SECRET),
    hasAuthSecret: Boolean(
      process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
    ),
    hasMongoUri: Boolean(process.env.MONGODB_URI),
    mongoOk,
  });
}
