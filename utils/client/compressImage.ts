import heic2any from "heic2any";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  return (
    type === "image/heic" ||
    type === "image/heif" ||
    file.name.toLowerCase().endsWith(".heic") ||
    file.name.toLowerCase().endsWith(".heif")
  );
}

async function resizeBlob(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("No se pudo generar el blob"))),
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}

export async function prepareImageForUpload(file: File): Promise<File> {
  let blob: Blob = file;

  if (isHeic(file)) {
    const converted = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: JPEG_QUALITY,
    });
    blob = Array.isArray(converted) ? converted[0] : converted;
  }

  const resized = await resizeBlob(blob);
  const name = file.name.replace(/\.(heic|heif)$/i, ".jpg");
  return new File([resized], name, { type: "image/jpeg" });
}