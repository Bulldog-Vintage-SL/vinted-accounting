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

export type Platform = 'vinted' | 'wallapop' | 'vestiaire'

type FieldValidator = (listing: any) => MissingField | null

const FIELD_VALIDATORS: Record<string, FieldValidator> = {
  title: (listing) =>
    !listing?.title?.trim() ? { key: 'title', label: 'título' } : null,

  description: (listing) =>
    !listing?.description?.trim() ? { key: 'description', label: 'descripción' } : null,

  price: (listing) =>
    listing?.price === null || listing?.price === undefined || listing?.price === '' || Number(listing.price) <= 0
      ? { key: 'price', label: 'precio' }
      : null,

  colors: (listing) =>
    !Array.isArray(listing?.colors) || listing.colors.length === 0
      ? { key: 'colors', label: 'colores' }
      : null,

  photo_url: (listing) =>
    !Array.isArray(listing?.photo_url) || listing.photo_url.length === 0
      ? { key: 'photo_url', label: 'foto' }
      : null,

  brand: (listing) =>
    !listing?.attributes?.brand?.trim() ? { key: 'attributes.brand', label: 'marca' } : null,

  status: (listing) =>
    !listing?.status?.trim() ? { key: 'status', label: 'condición' } : null,

  size: (listing) =>
    !listing?.attributes?.size?.trim() ? { key: 'attributes.size', label: 'talla' } : null,

  item_type: (listing) =>
    !listing?.item_type?.trim() ? { key: 'item_type', label: 'tipo' } : null,

  gender: (listing) =>
    !listing?.gender ? { key: 'gender', label: 'género' } : null,
}

// Campos requeridos por plataforma
const PLATFORM_REQUIRED_FIELDS: Record<Platform, (keyof typeof FIELD_VALIDATORS)[]> = {
  vinted: ['title', 'description', 'price', 'colors', 'photo_url', 'brand', 'status', 'size'],
  wallapop: ['title', 'description', 'price', 'colors', 'photo_url', 'brand', 'status', 'size', 'item_type'],
  vestiaire: ['title', 'description', 'price', 'colors', 'photo_url', 'brand', 'status', 'size', 'item_type', 'gender'],
}

export function validateListingRequiredFields(listing: any, platform: Platform): MissingField[] {
  const requiredFields = PLATFORM_REQUIRED_FIELDS[platform]

  if (!requiredFields) {
    throw new Error(`Plataforma desconocida: ${platform}`)
  }

  const missing: MissingField[] = []

  for (const fieldKey of requiredFields) {
    const result = FIELD_VALIDATORS[fieldKey](listing)
    if (result) missing.push(result)
  }

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