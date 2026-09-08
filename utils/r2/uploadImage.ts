import { PutObjectCommand } from "@aws-sdk/client-s3"
import { r2Client } from "./client"
import sharp from "sharp"
import convert from "heic-convert"

const HEIC_MIME_TYPES = ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]

function isHeicBuffer(buffer: Buffer): boolean {
    // Los HEIC son contenedores ISOBMFF: bytes 4-11 tienen "ftyp" + brand (heic, heix, hevc, mif1...)
    if (buffer.length < 12) return false
    const ftyp = buffer.toString("ascii", 4, 8)
    const brand = buffer.toString("ascii", 8, 12)
    return ftyp === "ftyp" && ["heic", "heix", "hevc", "mif1", "heim", "heis"].includes(brand)
}

async function normalizeToProcessableBuffer(buffer: Buffer, mimeType?: string): Promise<Buffer> {
    const looksHeic = (mimeType && HEIC_MIME_TYPES.includes(mimeType.toLowerCase())) || isHeicBuffer(buffer)
    if (!looksHeic) return buffer

    try {
        const jpegBuffer = await convert({
            buffer: buffer as any,
            format: "JPEG",
            quality: 0.9,
        })
        return Buffer.from(jpegBuffer)
    } catch (err) {
        throw new Error(`No se pudo convertir el HEIC: ${(err as Error).message}`)
    }
}

async function compressAndUpload(buffer: Buffer, key: string, mimeType?: string): Promise<string> {
    const safeBuffer = await normalizeToProcessableBuffer(buffer, mimeType)

    const compressed = await sharp(safeBuffer)
        .rotate() // respeta la orientación EXIF, importante en fotos de iPhone
        .resize(800, 800, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer()

    await r2Client.send(new PutObjectCommand({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
        Key: key,
        Body: compressed,
        ContentType: "image/webp",
    }))

    return `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`
}

export async function uploadImageFromUrl(imageUrl: string, key: string): Promise<string> {
    const response = await fetch(imageUrl)
    console.log('Status imagen:', response.status, imageUrl)
    if (!response.ok) throw new Error(`Error descargando imagen: ${imageUrl}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    const mimeType = response.headers.get("content-type") ?? undefined
    return compressAndUpload(buffer, key, mimeType)
}

export async function uploadImageFromBase64(base64: string, key: string): Promise<string> {
    const match = base64.match(/^data:(image\/\w+);base64,/)
    const mimeType = match?.[1]
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, "")
    const buffer = Buffer.from(base64Data, "base64")
    return compressAndUpload(buffer, key, mimeType)
}

export async function uploadImageFromBuffer(buffer: Buffer, key: string, mimeType?: string): Promise<string> {
    return compressAndUpload(buffer, key, mimeType)
}