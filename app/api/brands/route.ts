import { NextResponse } from "next/server";
import brandsData from "@/data/brands.json";

const brands = brandsData as string[];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.toLowerCase() ?? "";

  const filtered = q
    ? brands.filter(b => b.toLowerCase().includes(q))
    : brands;

  return NextResponse.json(filtered);
}   