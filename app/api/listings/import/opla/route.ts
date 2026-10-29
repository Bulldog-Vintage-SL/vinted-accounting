import { NextResponse } from 'next/server'
import connectMongo from '@/libs/mongoose'
import Listing from '@/models/Listing'
import Publication from '@/models/Publication'
import { getAuthenticatedUserId } from '@/libs/accounts/get-user'
import { uploadImageFromUrl } from '@/utils/r2/uploadImage'
import { matchBrand } from '@/lib/brands'
import mongoose from 'mongoose'
import { COLOR_OPTIONS} from '@/data/colors'
import { SIZE_OPTIONS } from '@/data/sizes'

export const dynamic = 'force-dynamic'

const OPLA_IMAGE_ORIGIN = 'https://d2f61lx5s6m7uh.cloudfront.net'


function imageUrl(image: unknown): string | null {
  const value = typeof image === 'object' && image !== null
    ? (image as Record<string, unknown>).url ??
      (image as Record<string, unknown>).src ??
      (image as Record<string, unknown>).key ??
      (image as Record<string, unknown>).path ??
      (image as Record<string, unknown>).publicUrl
    : image
  if (typeof value !== 'string' || !value.trim()) return null
  if (/^https?:\/\//i.test(value)) return value
  return `${OPLA_IMAGE_ORIGIN}/${value.split('/').map(encodeURIComponent).join('/')}`
}

async function uploadWithFallback(url: string, key: string): Promise<string | null> {
  // Original primero; si falla, el _thumb que sirve la web
  const candidates = [url, url.replace(/\.webp$/i, '_thumb.webp')]
  for (const candidate of candidates) {
    try {
      const result = await uploadImageFromUrl(candidate, key)
      if (result) return result
    } catch (e) {
      console.error('img fail', candidate, e instanceof Error ? e.message : e)
    }
  }
  return null
}

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>
    for (const key of ['name', 'label', 'title', 'value', 'slug']) {
      if (typeof object[key] === 'string' && object[key].trim()) return object[key].trim()
    }
  }
  return ''
}

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s-]+/g, '_').trim()

async function resolveBrand(rawBrand: string): Promise<string | null> {
  if (!rawBrand) return null
  try {
    const matched = await matchBrand(rawBrand)
    if (!matched) console.warn('Opla: marca sin coincidencia en BD, se conserva el nombre original:', rawBrand)
    return matched ?? rawBrand
  } catch (e) {
    console.error('Opla: error en matchBrand', rawBrand, e instanceof Error ? e.message : e)
    return rawBrand
  }
}

/* ---------- mapeos Opla -> tu modelo ---------- */

const GENDER_PREFIX: Record<string, 'hombre' | 'mujer' | 'unisex'> = {
  MEN: 'hombre', MENS: 'hombre',
  WOMEN: 'mujer', WOMENS: 'mujer',
  UNISEX: 'unisex',
}

const GENDER_LABEL = { hombre: 'Hombre', mujer: 'Mujer', unisex: 'Unisex' } as const

// Ajusta las claves a los valores reales de Opla (solo he visto "good")
const CONDITION_MAP: Record<string, string> = {
  new_with_tags: 'Nuevo', new: 'Nuevo',
  like_new: 'Como nuevo', very_good: 'Como nuevo',
  good: 'Bueno',
  satisfactory: 'Aceptable', fair: 'Aceptable', acceptable: 'Aceptable',
}

const COLOR_ALIASES: Record<string, string> = {
  black: 'Negro', gray: 'Gris', grey: 'Gris', white: 'Blanco', cream: 'Crema', beige: 'Beige',
  orange: 'Naranja', pastel_orange: 'Naranja pastel', coral: 'Coral', red: 'Rojo',
  burgundy: 'Burdeos', fuchsia: 'Fucsia', pink: 'Rosa', purple: 'Morado', lilac: 'Lila',
  light_blue: 'Azul claro', blue: 'Azul', navy: 'Azul marino', turquoise: 'Turquesa',
  mint: 'Menta', green: 'Verde', dark_green: 'Verde oscuro', khaki: 'Caqui', brown: 'Marrón',
  mustard: 'Mostaza', yellow: 'Amarillo', silver: 'Plateado', gold: 'Dorado',
  multi: 'Varios', multicolor: 'Varios', multicolour: 'Varios', transparent: 'Transparente',
}
const COLOR_BY_NORM = new Map<string, string>([
  ...COLOR_OPTIONS.map((c) => [norm(c), c] as [string, string]),
  ...Object.entries(COLOR_ALIASES),
])

const SIZE_BY_NORM = new Map<string, string>(SIZE_OPTIONS.map((s) => [norm(s), s]))
const SIZE_ALIASES: Record<string, string> = {
  one_size: 'Talla única', onesize: 'Talla única', unica: 'Talla única', xxs: 'XS',
}

const TOP_GROUPS = new Set(['TOP', 'TOPS', 'OUTERWEAR', 'KNITWEAR', 'SWEATERS'])
const BOTTOM_GROUPS = new Set(['BOTTOM', 'BOTTOMS', 'PANTS', 'JEANS', 'SHORTS', 'SKIRTS'])

// Etiquetas en español por tipo; lo que no esté aquí cae al fallback (Title Case)
const TYPE_LABELS: Record<string, string> = {
  T_SHIRTS: 'Camisetas', SHIRTS: 'Camisas', POLOS: 'Polos', TANK_TOPS: 'Camisetas de tirantes',
  SWEATSHIRTS: 'Sudaderas', HOODIES: 'Sudaderas con capucha', SWEATERS: 'Jerséis',
  CARDIGANS: 'Cárdigans', JACKETS: 'Chaquetas', COATS: 'Abrigos', BLAZERS: 'Americanas',
  JEANS: 'Vaqueros', PANTS: 'Pantalones', TROUSERS: 'Pantalones', SHORTS: 'Pantalones cortos',
  SKIRTS: 'Faldas', DRESSES: 'Vestidos', SHOES: 'Zapatos', SNEAKERS: 'Zapatillas',
}

function parseCategory(raw: string) {
  const [prefix = '', group = '', ...rest] = raw.split('_')
  const gender = GENDER_PREFIX[prefix.toUpperCase()] ?? null
  const type = rest.join('_') || group
  const garmentType: 'arriba' | 'abajo' | null = TOP_GROUPS.has(group) ? 'arriba'
    : BOTTOM_GROUPS.has(group) ? 'abajo' : null

  const typeLabel = TYPE_LABELS[type] ??
    type.toLowerCase().split('_').filter(Boolean).map((w, i) => (i === 0 ? w[0]?.toUpperCase() + w.slice(1) : w)).join(' ')
  const categoryPath = raw
    ? [gender ? GENDER_LABEL[gender] : null, 'Ropa', typeLabel].filter(Boolean).join(' > ')
    : null

  return { gender, type, garmentType, categoryPath }
}

function mapSizes(item: any): { size: string | null; allSizes: string[] } {
  const meta = item.metadata ?? {}
  const raw: unknown[] = Array.isArray(meta.sizes)
    ? meta.sizes
    : [item.size ?? meta.size].filter(Boolean)
  const all = raw.map(text).filter(Boolean)
  const mapped = all.map((s) => SIZE_BY_NORM.get(norm(s)) ?? SIZE_ALIASES[norm(s)] ?? s)
  return { size: mapped[0] ?? null, allSizes: mapped }
}

function inferListingFields(item: Record<string, any>) {
  const meta = item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
  const rawCategory = text(item.category) || text(meta.category)
  const cat = parseCategory(rawCategory)

  const rawColors = [
    ...(Array.isArray(item.colors) ? item.colors : []),
    ...(Array.isArray(meta.colors) ? meta.colors : []),
  ].map(text).filter(Boolean)
  const colors = Array.from(new Set(
    rawColors.map((c) => COLOR_BY_NORM.get(norm(c))).filter((c): c is string => Boolean(c))
  ))
  const unmappedColors = rawColors.filter((c) => !COLOR_BY_NORM.has(norm(c)))
  if (unmappedColors.length) console.warn('Opla: colores sin mapear:', unmappedColors)

  const { size, allSizes } = mapSizes(item)

  const rawCondition = text(item.condition) || text(meta.condition)
  const condition = CONDITION_MAP[norm(rawCondition)] ?? null
  if (rawCondition && !condition) console.warn('Opla: condition sin mapear:', rawCondition)

  return {
    rawCategory,
    categoryPath: cat.categoryPath,
    gender: cat.gender,
    itemType: cat.type || null,
    garmentType: cat.garmentType,
    condition,
    rawCondition,
    size,
    allSizes,
    colors,
    rawColors,
  }
}

/* ---------- handler ---------- */

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) return NextResponse.json({ status: 'error', message: 'Usuario no autenticado' }, { status: 401 })

    const body = await req.json()
    if (!Array.isArray(body.wardrobe) || !body.accountId) {
      return NextResponse.json({ status: 'error', message: 'Datos de importación inválidos' }, { status: 400 })
    }

    await connectMongo()

    let created = 0
    let alreadyImported = 0
    let blockedByOtherUser = 0
    for (const item of body.wardrobe) {
      const result = await importArticle(item, userId, body.accountId)
      if (result === 'created') created++
      else if (result === 'already-imported') alreadyImported++
      else blockedByOtherUser++
    }

    return NextResponse.json({
      status: 'success',
      message: `Productos procesados: ${created} importados${alreadyImported ? `, ${alreadyImported} ya existentes` : ''}${blockedByOtherUser ? `, ${blockedByOtherUser} vinculados a otro usuario` : ''}`,
      created,
      alreadyImported,
      blockedByOtherUser,
    })
  } catch (error) {
    console.error('Error procesando productos de Opla:', error)
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Error desconocido',
    }, { status: 400 })
  }
}

type ImportResult = 'created' | 'already-imported' | 'blocked-by-other-user'

async function importArticle(item: any, userId: string, accountId: string): Promise<ImportResult> {
  const externalId = String(item?.id ?? '')
  if (!externalId) return 'blocked-by-other-user'

  const existing = await Publication.findOne({ platform: 'opla', externalId })
  if (existing) {
    const linkedListing = existing.listingId ? await Listing.findById(existing.listingId) : null
    if (linkedListing?.userId?.toString() === userId) return 'already-imported'
    if (linkedListing) return 'blocked-by-other-user'
    await Publication.deleteOne({ _id: existing._id })
  }

  const meta = item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
  const fields = inferListingFields(item)
  const rawBrand = text(item.brand)
  const brand = await resolveBrand(rawBrand)

  const rawImages: unknown[] = Array.isArray(item.images) ? item.images
    : Array.isArray(item.photos) ? item.photos : []
  const photoUrls = await Promise.all(
    rawImages
      .map(imageUrl)
      .filter((url): url is string => Boolean(url))
      .map((url, index) => uploadWithFallback(url, `listings/${userId}/${externalId}_${index}.webp`))
  )

  const priceCents = Number(item.priceCents ?? item.price?.cents)
  const price = Number.isFinite(priceCents) ? priceCents / 100 : null

  const listing = await Listing.create({
    userId: new mongoose.Types.ObjectId(userId),
    title: item.title || 'Producto de Opla',
    description: item.description || '',
    status: item.status === 'sold' ? 'sold' : 'active',
    condition: fields.condition,
    price,
    colors: fields.colors,
    gender: fields.gender,
    itemType: fields.itemType,
    sku: text(item.sku) || text(item.reference) || null,
    tags: Array.isArray(item.tags) ? item.tags.map(text).filter(Boolean) : [],
    stock: Number.isFinite(Number(item.stock)) ? Number(item.stock) : 1,
    photoUrl: photoUrls.filter((url): url is string => Boolean(url)),
    attributes: {
      brand,
      size: fields.size,
      categoryPath: fields.categoryPath ?? fields.rawCategory ?? null,
      vintedCategoryId: null,
      garmentType: fields.garmentType,
      medidas: item.measurements ?? meta.measurements ?? null,
      desperfectos: ['Sin desperfectos'],
      costeInicial: null,
      opla: {
        id: externalId,
        rawBrand: rawBrand || null,
        rawCategory: fields.rawCategory,
        rawCondition: fields.rawCondition,
        rawColors: fields.rawColors,
        sizes: fields.allSizes,
        material: item.material ?? meta.material ?? null,
        country: item.country ?? meta.country ?? null,
        buyerTotalCents: item.buyerTotalCents ?? null,
        favouriteCount: item.favouriteCount ?? null,
        viewCount: item.viewCount ?? null,
        createdAt: item.createdAt ?? null,
        updatedAt: item.updatedAt ?? null,
        moderationStatus: item.moderationStatus ?? null,
        metadata: meta,
      },
    },
  })

  await Publication.create({
    listingId: listing._id,
    platform: 'opla',
    platformId: 'opla',
    externalId,
    price,
    status: 'active',
    syncStatus: 'synced',
    lastSync: new Date(),
    publicationUrl: `https://www.opla.co/es/product/${encodeURIComponent(externalId)}`,
    accountId: new mongoose.Types.ObjectId(accountId),
  })
  return 'created'
}