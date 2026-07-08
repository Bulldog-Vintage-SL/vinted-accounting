import { PutObjectCommand } from "@aws-sdk/client-s3"
import { r2Client } from "./client"
import sharp from "sharp"

export async function uploadImageFromUrl(imageUrl: string, key: string): Promise<string> {
    const response = await fetch(imageUrl)
    console.log('Status imagen:', response.status, imageUrl)
    if (!response.ok) throw new Error(`Error descargando imagen: ${imageUrl}`)
    const buffer = Buffer.from(await response.arrayBuffer())

    const compressed = await sharp(buffer)
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

export async function uploadImageFromBase64(base64: string, key: string): Promise<string> {
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, "")
    const buffer = Buffer.from(base64Data, "base64")

    const compressed = await sharp(buffer)
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

export async function uploadImageFromBuffer(buffer: Buffer, key: string): Promise<string> {
    const compressed = await sharp(buffer)
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