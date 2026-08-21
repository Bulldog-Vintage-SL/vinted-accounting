// lib/brands.ts
import Fuse from "fuse.js";
import brandsData from "@/data/brands.json";

const BRANDS: string[] = brandsData as string[];

const fuse = new Fuse(BRANDS, {
  threshold: 0.3,
  ignoreDiacritics: true,
});

export function matchBrand(rawName: string): string | null {
  if (!rawName || rawName.trim().toLowerCase() === "sin marca") {
    return null;
  }

  const results = fuse.search(rawName.trim());
  return results.length > 0 ? results[0].item : null;
}