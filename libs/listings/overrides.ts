export interface ListingPublishOverrides {
  title?: string;
  description?: string;
  photoUrl?: string[];
}

export function applyListingPublishOverrides<
  T extends {
    title?: string | null;
    description?: string | null;
    photoUrl?: string[];
  },
>(listing: T, overrides?: ListingPublishOverrides | null): T {
  if (!overrides) return listing;
  if (typeof overrides.title === "string") listing.title = overrides.title;
  if (typeof overrides.description === "string") {
    listing.description = overrides.description;
  }
  if (
    Array.isArray(overrides.photoUrl) &&
    overrides.photoUrl.every((url) => typeof url === "string")
  ) {
    listing.photoUrl = overrides.photoUrl;
  }
  return listing;
}
