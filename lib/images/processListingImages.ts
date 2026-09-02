import { transformImage } from "./imageTransform";
import type { Listing } from "@/app/inventory/listings/types";

function randomInRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
}

async function fetchAndTransform(url: string): Promise<Blob> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`No se pudo descargar la imagen: ${url} (${res.status})`);
    }
    const blob = await res.blob();

    return transformImage(blob, {
        cropPercent: randomInRange(0.01, 0.03),
        noiseIntensity: randomInRange(3, 7),
        brightnessShift: randomInRange(-0.05, 0.05),
        rotationDeg: randomInRange(-0.5, 0.5),
    });
}

export async function transformListingImages(
    listing: Listing
): Promise<Blob[]> {
    const transformedImages = await Promise.all(
        listing.photo_url.map((url) => fetchAndTransform(url))
    );

    return transformedImages;
}