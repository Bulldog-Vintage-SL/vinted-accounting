import type { ListingForm } from "@/app/inventory/listings/types";

export function validateListingCreationFields(
  data: Pick<ListingForm, "title" | "photo_url">
): string | null {
  if (!data.title?.trim()) {
    return "El título es obligatorio";
  }

  if (!Array.isArray(data.photo_url) || data.photo_url.length === 0) {
    return "Debes añadir al menos una foto";
  }

  return null;
}
