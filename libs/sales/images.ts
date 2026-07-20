export function normalizeSaleItemName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildListingImageLookup(
  listings: Array<{ title?: string | null; photoUrl?: string[] | null }>
): Map<string, string> {
  const map = new Map<string, string>();

  for (const listing of listings) {
    const photo = listing.photoUrl?.[0];
    if (!listing.title || !photo) continue;

    const key = normalizeSaleItemName(listing.title);
    if (!map.has(key)) {
      map.set(key, photo);
    }
  }

  return map;
}

export function resolveSaleImageUrl(
  sale: { itemName: string; itemImageUrl?: string | null },
  listingLookup: Map<string, string>
): string | undefined {
  if (sale.itemImageUrl) {
    return sale.itemImageUrl;
  }

  return listingLookup.get(normalizeSaleItemName(sale.itemName));
}
