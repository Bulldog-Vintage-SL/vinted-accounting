import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Brand from "@/models/Brand";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";

export const dynamic = "force-dynamic";

const MAX_RESULTS = 20;
const MIN_QUERY_LENGTH = 2;

export async function GET(req: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";

    if (q.length < MIN_QUERY_LENGTH) {
      return NextResponse.json([]);
    }

    await connectMongo();

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");

    const brands = await Brand.find({ name: regex })
      .select("name")
      .limit(MAX_RESULTS * 3)
      .lean();

    const lowerQ = q.toLowerCase();

    const sorted = brands
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(lowerQ);
        const bStarts = b.name.toLowerCase().startsWith(lowerQ);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.name.length - b.name.length;
      })
      .slice(0, MAX_RESULTS);

    return NextResponse.json(sorted.map((b) => b.name));
  } catch (err) {
    console.error("Error buscando marcas:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 400 }
    );
  }
}