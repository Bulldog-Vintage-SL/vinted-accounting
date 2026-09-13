import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import { uploadImageFromBuffer } from "@/utils/r2/uploadImage";
import { deleteImageByUrl, extractKeyFromUrl } from "@/utils/r2/deleteImage";

export const dynamic = "force-dynamic";

const ALLOWED_DEGREES = new Set([90, -90, 180]);

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const degrees = Number(body.degrees ?? 90);

    if (!url || !ALLOWED_DEGREES.has(degrees)) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }

    let key: string;
    try {
      key = extractKeyFromUrl(url);
    } catch {
      return NextResponse.json({ error: "URL de imagen no válida" }, { status: 400 });
    }

    if (!key.startsWith(`listings/${userId}/`)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json({ error: "No se pudo leer la imagen" }, { status: 422 });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const rotated = await sharp(buffer).rotate(degrees).toBuffer();
    const newUrl = await uploadImageFromBuffer(
      rotated,
      `listings/${userId}/${randomUUID()}.webp`,
      "image/webp"
    );

    try {
      await deleteImageByUrl(url);
    } catch (err) {
      console.error("No se pudo borrar la imagen original tras rotar:", err);
    }

    return NextResponse.json({ url: newUrl });
  } catch (err) {
    console.error("Error rotando imagen:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo rotar la imagen" },
      { status: 400 }
    );
  }
}
