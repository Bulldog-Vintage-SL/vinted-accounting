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
  let blob: Blob = file;

  if (await isHeic(file)) {
    try {
      const jpeg = await heicTo({
        blob: file,
        type: "image/jpeg",
        quality: JPEG_QUALITY,
      });
      blob = jpeg;
    } catch (err) {
      console.error("Fallo al convertir HEIC con heic-to:", file.name, file.size, err);
      throw new Error(
        `No se pudo convertir "${file.name}" (HEIC). Prueba a exportarla como JPEG desde el iPhone antes de subirla.`
      );
    }
  }

  try {
    const resized = await resizeBlob(blob);
    const name = file.name.replace(/\.(heic|heif)$/i, ".jpg");
    return new File([resized], name, { type: "image/jpeg" });
  } catch (err) {
    console.error("Fallo al redimensionar imagen:", file.name, err);
    throw new Error(`No se pudo procesar "${file.name}" en el navegador.`);
  }
}