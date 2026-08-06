import { DeleteObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3"
import { r2Client } from "./client"

const PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL!
const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME!

export function extractKeyFromUrl(url: string): string {
    if (!url.startsWith(PUBLIC_URL)) {
        throw new Error(`URL no pertenece al bucket configurado: ${url}`)
    }
    return url.slice(PUBLIC_URL.length).replace(/^\/+/, "")
}

export async function deleteImage(key: string): Promise<void> {
    await r2Client.send(new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
    }))
}

export async function deleteImageByUrl(url: string): Promise<void> {
    return deleteImage(extractKeyFromUrl(url))
}


export async function deleteImages(keys: string[]): Promise<void> {
    if (keys.length === 0) return

    const CHUNK_SIZE = 1000
    for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
        const chunk = keys.slice(i, i + CHUNK_SIZE)

        const result = await r2Client.send(new DeleteObjectsCommand({
            Bucket: BUCKET,
            Delete: {
                Objects: chunk.map((Key) => ({ Key })),
                Quiet: true,
            },
        }))

        if (result.Errors && result.Errors.length > 0) {
            console.error("Errores borrando objetos de R2:", result.Errors)
            throw new Error(
                `Fallo al borrar ${result.Errors.length} de ${chunk.length} imágenes: ` +
                result.Errors.map(e => `${e.Key} (${e.Code})`).join(", ")
            )
        }
    }
}

export async function deleteImagesByUrls(urls: string[]): Promise<void> {
    return deleteImages(urls.map(extractKeyFromUrl))
}