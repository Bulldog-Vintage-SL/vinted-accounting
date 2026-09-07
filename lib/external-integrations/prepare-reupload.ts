import { uploadPhoto } from "@/utils/uploadPhoto";
import { transformListingImages } from "../images/processListingImages";
import type { Listing } from "@/app/inventory/listings/types";

export async function prepareListingForReupload(listing: Listing): Promise<{
  modifiedListing: Listing;
  newTitle: string;
  newDescription: string;
}> {
  const transformedImages = await transformListingImages(listing);

  const uploadedUrls = await Promise.all(
    transformedImages.map((blob, i) =>
      uploadPhoto(
        new File([blob], `${listing.id}_${i}.jpg`, { type: "image/jpeg" })
      )
    )
  );

  const resModTexts = await fetch("/api/modify-texts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: listing.title,
      description: listing.description,
    }),
  });

  if (!resModTexts.ok) {
    throw new Error("Error modificando título y descripción");
  }

  const { title: newTitle, description: newDescription } =
    await resModTexts.json();

  return {
    modifiedListing: {
      ...listing,
      photo_url: uploadedUrls,
      title: newTitle,
      description: newDescription,
    },
    newTitle,
    newDescription,
  };
}
