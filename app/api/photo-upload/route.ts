import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { uploadImageFromBuffer } from "@/utils/r2/uploadImage";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `listings/${userId}/${randomUUID()}.webp`;

  try {
    const url = await uploadImageFromBuffer(buffer, key, file.type);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("Error procesando imagen:", file.name, file.type, err);
    return NextResponse.json({ error: "No se pudo procesar la imagen" }, { status: 422 });
  }
}