import { heicTo, isHeic as isHeicFile } from "heic-to";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

async function isHeic(file: File): Promise<boolean> {
  // heic-to comprueba la firma real del archivo, no solo el mimetype/extensión,
  // así que detecta también HEIC mal etiquetados por el navegador/OS
  try {
    return await isHeicFile(file);
  } catch {
    return false;
  }
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
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("No se pudo generar el blob del canvas"))),
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}

export async function prepareImageForUpload(file: File): Promise<File> {
  console.log("→ Empezando a procesar:", file.name, file.size, file.type);

  let blob: Blob = file;

  const heic = await isHeic(file);
  console.log("→ ¿Es HEIC?", heic);

  if (heic) {
    try {
      console.log("→ Convirtiendo con heic-to...");
      const jpeg = await heicTo({
        blob: file,
        type: "image/jpeg",
        quality: JPEG_QUALITY,
      });
      console.log("→ Conversión OK, tamaño resultante:", jpeg.size);
      blob = jpeg;
    } catch (err) {
      console.error("→ FALLO en heic-to:", err);
      throw new Error(`No se pudo convertir "${file.name}" (HEIC).`);
    }
  }

  try {
    console.log("→ Redimensionando...");
    const resized = await resizeBlob(blob);
    console.log("→ Redimensionado OK, tamaño final:", resized.size);
    const name = file.name.replace(/\.(heic|heif)$/i, ".jpg");
    return new File([resized], name, { type: "image/jpeg" });
  } catch (err) {
    console.error("→ FALLO al redimensionar:", err);
    throw new Error(`No se pudo procesar "${file.name}" en el navegador.`);
  }
}