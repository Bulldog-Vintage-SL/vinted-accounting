// lib/brands.ts
import connectMongo from "@/libs/mongoose";
import Brand from "@/models/Brand";

export async function matchBrand(rawName: string): Promise<string | null> {
  const trimmed = rawName?.trim();
  if (!trimmed || trimmed.toLowerCase() === "sin marca") {
    return null;
  }

  await connectMongo();

  const results = await Brand.aggregate([
    {
      $search: {
        index: "brands_fuzzy",
        text: {
          query: trimmed,
          path: "name",
          fuzzy: { maxEdits: 2, prefixLength: 1 },
        },
      },
    },
    { $limit: 1 },
    { $project: { _id: 0, name: 1 } },
  ]);


  console.log(results[0]?.name)
  return results[0]?.name ?? null;
}