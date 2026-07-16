import type { MissingField } from '@/lib/queue/types'

export type UploadResult =
  | { ok: true; message?: string; data?: any }
  | { ok: false; message: string; missingFields?: MissingField[] }

export class MissingFieldsError extends Error {
  fields: MissingField[]

  constructor(fields: MissingField[]) {
    super(`Faltan campos obligatorios: ${fields.map(f => f.label).join(', ')}`)
    this.name = 'MissingFieldsError'
    this.fields = fields
  }
}

// Campos obligatorios para publicar
export function validateListingRequiredFields(listing: any): MissingField[] {
  const missing: MissingField[] = []

  if (!listing?.title?.trim()) missing.push({ key: 'title', label: 'título' })
  if (!listing?.description?.trim()) missing.push({ key: 'description', label: 'descripción' })
  if (listing?.price === null || listing?.price === undefined || listing?.price === "" || Number(listing.price) <= 0) {
    missing.push({ key: 'price', label: 'precio' })
  }
  if (!Array.isArray(listing?.colors) || listing.colors.length === 0) {
    missing.push({ key: 'colors', label: 'colores' })
  }
  if (!Array.isArray(listing?.photo_url) || listing.photo_url.length === 0) {
    missing.push({ key: 'photo_url', label: 'foto' })
  }
  if (!listing?.attributes?.brand?.trim()) missing.push({ key: 'attributes.brand', label: 'marca' })
  if (!listing?.condition?.trim()) missing.push({ key: 'condition', label: 'condición' })
  if (!listing?.attributes?.size?.trim()) missing.push({ key: 'attributes.size', label: 'talla' })
  if (!listing?.item_type?.trim()) missing.push({ key: 'item_type', label: 'tipo' })

  return missing
}

// Aplica un patch resolviendo campos anidados
export function applyFieldPatch<T extends Record<string, any>>(entity: T, patch: Record<string, any>): T {
  const clone: any = structuredClone(entity)

  for (const [path, value] of Object.entries(patch)) {
    const parts = path.split('.')
    let cursor = clone
    for (let i = 0; i < parts.length - 1; i++) {
      cursor[parts[i]] = cursor[parts[i]] ?? {}
      cursor = cursor[parts[i]]
    }
    cursor[parts[parts.length - 1]] = value
  }

  return clone
}

export function isUploadFailure(
  res: UploadResult
): res is Extract<UploadResult, { ok: false }> {
  return res.ok === false
}