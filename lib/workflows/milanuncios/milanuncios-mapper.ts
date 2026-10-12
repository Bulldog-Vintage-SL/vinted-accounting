import { MILANUNCIOS_FALLBACK_CATEGORY, MILANUNCIOS_ORIGIN } from './milanuncios-constants'

type CategoryNode = {
  id: string
  name: string
  aliasOf?: string
  children?: CategoryNode[]
  synonyms?: string[]
}

export function flattenCategories(
  nodes: CategoryNode[] | undefined,
  path: CategoryNode[] = []
): Array<{ node: CategoryNode; path: CategoryNode[] }> {
  const out: Array<{ node: CategoryNode; path: CategoryNode[] }> = []
  for (const node of nodes || []) {
    const nextPath = [...path, node]
    out.push({ node, path: nextPath })
    out.push(...flattenCategories(node.children, nextPath))
  }
  return out
}

/** Keywords del listing → términos que deben aparecer en el nombre de categoría. */
const PRODUCT_TO_CATEGORY: Array<{ match: RegExp; category: RegExp; score: number }> = [
  { match: /polo/, category: /polo/, score: 14 },
  { match: /camiset|t-?shirt/, category: /camiset/, score: 14 },
  { match: /jeans|vaquer|straight-?leg/, category: /pantal/, score: 14 },
  { match: /pantal/, category: /pantal/, score: 14 },
  { match: /camis(?!et)/, category: /camis/, score: 12 },
  { match: /zapatill|sneaker/, category: /zapatill/, score: 14 },
  { match: /bota|botin/, category: /bota/, score: 12 },
  { match: /sandalia/, category: /sandalia/, score: 12 },
  { match: /zapato/, category: /zapato|calzado/, score: 10 },
  { match: /abrigo|chaqueta|cazadora|sudadera|jersey/, category: /abrigo|chaqueta|jersey|sudadera/, score: 12 },
  { match: /vestido/, category: /vestido/, score: 14 },
  { match: /falda/, category: /falda/, score: 14 },
  { match: /bolso/, category: /bolso/, score: 12 },
  { match: /cintur/, category: /cintur/, score: 10 },
  { match: /reloj/, category: /reloj/, score: 10 },
]

function scoreCategory(
  entry: { node: CategoryNode; path: CategoryNode[] },
  gender: string | null | undefined,
  itemType: string | null | undefined,
  title: string | null | undefined
): number {
  const pathNames = entry.path.map((p) => p.name.toLowerCase())
  const root = pathNames[0] || ''
  const hay = [...pathNames, entry.node.name, ...(entry.node.synonyms || [])]
    .join(' ')
    .toLowerCase()
  const type = String(itemType || '').toLowerCase()
  const titleText = String(title || '').toLowerCase()
  const text = `${type} ${titleText}`
  const g = String(gender || '').toLowerCase()

  // Solo Moda y complementos (no Empleo > Diseño de moda, etc.)
  if (root !== 'moda y complementos') return -100
  if (hay.includes('empleo')) return -100

  let score = 0

  if (g.includes('mujer') || g === 'female' || g === 'f') {
    if (hay.includes('mujer')) score += 8
    if (hay.includes('hombre')) score -= 6
  } else if (g.includes('hombre') || g === 'male' || g === 'm') {
    if (hay.includes('hombre')) score += 8
    if (hay.includes('mujer')) score -= 6
  }

  for (const rule of PRODUCT_TO_CATEGORY) {
    if (rule.match.test(text) && rule.category.test(hay)) {
      score += rule.score
    }
  }

  // Penalizar calzado si el título habla de ropa/jeans
  if (/jeans|vaquer|pantal|camiset|camis|polo|vestido|falda/.test(text) && /calzado|alpargata|sandalia|zapato|zapatill/.test(hay)) {
    score -= 20
  }

  if (!entry.node.children?.length) score += 2
  // Preferir hoja "Ropa" frente a complementos genéricos cuando no hay match fuerte
  if (hay.includes('> ropa') || hay.includes(' ropa ')) score += 1

  return score
}

export function resolveMilanunciosCategory(
  tree: CategoryNode[],
  input: {
    gender?: string | null
    itemType?: string | null
    title?: string | null
    preferredCategoryId?: string | null
  }
): { id: string; path: string; name: string } {
  const preferred = String(input.preferredCategoryId || '').trim()
  const flat = flattenCategories(tree)

  if (preferred) {
    const hit = flat.find((e) => String(e.node.id) === preferred)
    if (hit) {
      return {
        id: String(hit.node.aliasOf || hit.node.id),
        path: hit.path.map((p) => p.name).join(' > '),
        name: hit.node.name,
      }
    }
  }

  let best = flat[0]
  let bestScore = -Infinity
  for (const entry of flat) {
    const score = scoreCategory(entry, input.gender, input.itemType, input.title)
    if (score > bestScore) {
      bestScore = score
      best = entry
    }
  }

  if (!best || bestScore < 0) {
    const g = String(input.gender || '').toLowerCase()
    const fallback =
      g.includes('mujer') || g === 'f' || g === 'female'
        ? MILANUNCIOS_FALLBACK_CATEGORY.mujer
        : MILANUNCIOS_FALLBACK_CATEGORY.hombre
    return { id: fallback, path: 'Moda y complementos', name: 'Fallback moda' }
  }

  return {
    id: String(best.node.aliasOf || best.node.id),
    path: best.path.map((p) => p.name).join(' > '),
    name: best.node.name,
  }
}

/** Condición del publish SPA: BRAND_NEW | ALMOST_NEW | GOOD_CONDITION | ACCEPTABLE | BAD_CONDITION */
export function mapMilanunciosItemCondition(condition: string | null | undefined): string {
  const c = String(condition || '').toLowerCase()
  if (c.includes('nuevo con etiqueta') || c.includes('new with tags') || c === 'new' || c === 'brand_new') {
    return 'BRAND_NEW'
  }
  if (c.includes('casi nuevo') || c.includes('as_new') || c.includes('like new') || c.includes('almost')) {
    return 'ALMOST_NEW'
  }
  if (c.includes('mejorable') || c.includes('bad') || c.includes('poor')) return 'BAD_CONDITION'
  if (c.includes('aceptable') || c.includes('fair') || c.includes('worn')) return 'ACCEPTABLE'
  if (c.includes('buen') || c.includes('good') || c.includes('excellent') || c.includes('muy buen')) {
    return 'GOOD_CONDITION'
  }
  if (c.includes('nuevo')) return 'ALMOST_NEW'
  return 'ALMOST_NEW'
}

/** Color del publish SPA: array de enums en inglés mayúsculas. */
export function mapMilanunciosPublishColors(colors: string[] | undefined): string[] {
  const first = String(colors?.[0] || '').toLowerCase().trim()
  if (!first) return []
  const map: Record<string, string> = {
    negro: 'BLACK',
    black: 'BLACK',
    blanco: 'WHITE',
    white: 'WHITE',
    gris: 'GREY',
    gray: 'GREY',
    grey: 'GREY',
    azul: 'BLUE',
    blue: 'BLUE',
    rojo: 'RED',
    red: 'RED',
    verde: 'GREEN',
    green: 'GREEN',
    amarillo: 'YELLOW',
    yellow: 'YELLOW',
    naranja: 'ORANGE',
    orange: 'ORANGE',
    rosa: 'PINK',
    pink: 'PINK',
    morado: 'PURPLE',
    purple: 'PURPLE',
    violeta: 'PURPLE',
    marron: 'BROWN',
    marrón: 'BROWN',
    brown: 'BROWN',
    beige: 'BEIGE',
    dorado: 'GOLD',
    gold: 'GOLD',
    plata: 'SILVER',
    silver: 'SILVER',
    multicolor: 'MULTICOLOR',
  }
  const mapped = map[first]
  if (mapped) return [mapped]
  return [first.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase()]
}

/** Body real del POST /draft: solo userId + categoryId. */
export function buildMilanunciosCreateDraftBody(state: {
  maCategoryId?: string
  maUserId?: string
}): Record<string, any> {
  return {
    userId: String(state.maUserId || ''),
    categoryId: String(state.maCategoryId || ''),
  }
}

function pickPhotoId(photo: any): string | null {
  const id =
    photo?.id ??
    photo?.imageId ??
    photo?.mediaId ??
    photo?.photoId ??
    photo?.data?.id ??
    photo?.images?.[0]?.id
  return id != null ? String(id) : null
}

function buildPublishLocation(maLocation: Record<string, any> | null | undefined): Record<string, any> | undefined {
  if (!maLocation) return undefined

  const localityId =
    maLocation.locality?.id ??
    maLocation.localityId ??
    maLocation.cityId ??
    maLocation.town?.id ??
    maLocation.municipality
  const provinceId =
    maLocation.province?.id ??
    maLocation.provinceId ??
    maLocation.region?.id

  const latitude = Number(
    maLocation.geoLocation?.latitude ??
      maLocation.latitude ??
      maLocation.lat ??
      maLocation.geoLocation?.lat
  )
  const longitude = Number(
    maLocation.geoLocation?.longitude ??
      maLocation.longitude ??
      maLocation.long ??
      maLocation.lng ??
      maLocation.geoLocation?.long
  )
  const hasGeo = Number.isFinite(latitude) && Number.isFinite(longitude)

  // SPA (8848): location = { locality:{id}, province:{id}, geoLocation:{latitude,longitude}, street? }
  if (localityId != null || provinceId != null || hasGeo) {
    const location: Record<string, any> = {}
    if (localityId != null) location.locality = { id: Number(localityId) }
    if (provinceId != null) location.province = { id: Number(provinceId) }
    if (hasGeo) location.geoLocation = { latitude, longitude }
    const zip = maLocation.zipCode || maLocation.postalCode || maLocation.zipcode
    if (zip) location.zipCode = String(zip)
    const streetName = maLocation.street?.name ?? maLocation.streetName
    if (streetName) {
      location.street = {
        name: String(streetName),
        ...(maLocation.street?.number != null || maLocation.streetNumber != null
          ? { number: String(maLocation.street?.number ?? maLocation.streetNumber) }
          : {}),
      }
    }
    return location
  }

  return undefined
}

/**
 * Body real del POST /api/v2/classifieds (captura SPA).
 * No usa formId/attributes/status del draft.
 */
export function buildMilanunciosPublishBody(state: {
  maDraftId?: string
  maCategoryId?: string
  maUserId?: string
  maLocation?: Record<string, any> | null
  maPhotos?: any[]
  originalPayload?: any
}): Record<string, any> {
  const listing = state.originalPayload?.listing || {}
  const price = Number(listing.price)
  const colors = mapMilanunciosPublishColors(listing.colors)
  const size = listing.attributes?.size || listing.size || undefined

  const images = (state.maPhotos || [])
    .map((photo, index) => {
      const id = pickPhotoId(photo)
      if (!id) return null
      return { id, sorting: index + 1, type: 'IMAGE' as const }
    })
    .filter(Boolean) as Array<{ id: string; sorting: number; type: 'IMAGE' }>

  const body: Record<string, any> = {
    adId: String(state.maDraftId || ''),
    userId: String(state.maUserId || ''),
    category: Number(state.maCategoryId),
    title: String(listing.title || '').slice(0, 70),
    description: String(listing.description || ''),
    price: Number.isFinite(price) ? price : 0,
    transactionType: 'OFFER',
    itemCondition: mapMilanunciosItemCondition(listing.condition),
    packageWeight: 'UP_TO_2KG',
  }

  if (size) body.size = String(size)
  if (colors.length) body.color = colors
  if (images.length) body.images = { images }
  if (listing.attributes?.brand) body.brand = String(listing.attributes.brand)

  const location = buildPublishLocation(state.maLocation || null)
  if (location) body.location = location

  return body
}

/** @deprecated Draft PUT ya no lleva el anuncio completo; se mantiene por compat. */
export function buildMilanunciosDraftBody(state: {
  maCategoryId?: string
  maUserId?: string
  maDraftId?: string
}): Record<string, any> {
  return buildMilanunciosCreateDraftBody(state)
}

export function normalizeMilanunciosUserId(raw: unknown): string | null {
  if (raw == null) return null
  const value = String(raw).replace(/^"+|"+$/g, '').trim()
  if (!value || value === 'null' || value === 'undefined') return null

  const sdrn = value.match(/sdrn:[^:]+:user:(\d+)/i)
  if (sdrn?.[1]) return sdrn[1]

  const trailing = value.match(/(?:^|[^\d])(\d{6,})(?:$|[^\d])/)
  if (/^\d+$/.test(value)) return value
  if (trailing?.[1]) return trailing[1]

  return null
}

export function pickMilanunciosUserId(result: any): string | null {
  const candidates = [
    result?.userId,
    result?.id,
    result?.user?.id,
    result?.profile?.userId,
    result?.data?.userId,
    result?.data?.id,
  ]
  for (const candidate of candidates) {
    const normalized = normalizeMilanunciosUserId(candidate)
    if (normalized) return normalized
  }
  return null
}

export function pickMilanunciosDraftId(result: any): string | null {
  const id =
    result?.id ??
    result?.adId ??
    result?.draftId ??
    result?.data?.id ??
    result?.classified?.id
  return id != null ? String(id) : null
}

export function pickMilanunciosPublicationUrl(result: any, draftId?: string | null): string {
  const url =
    result?.url ??
    result?.permalink ??
    result?.shareUrl ??
    result?.publicationUrl ??
    result?.data?.url
  if (url) return String(url)
  if (draftId) return `${MILANUNCIOS_ORIGIN}/anuncios/${draftId}`
  return MILANUNCIOS_ORIGIN
}

function looksLikeLocation(value: any): boolean {
  if (!value || typeof value !== 'object') return false
  return (
    value.latitude != null ||
    value.longitude != null ||
    value.lat != null ||
    value.lng != null ||
    value.long != null ||
    !!value.postalCode ||
    !!value.zipCode ||
    !!value.city ||
    !!value.region ||
    !!value.province ||
    value.locality?.id != null ||
    value.province?.id != null ||
    value.localityId != null ||
    value.provinceId != null
  )
}

export function pickMilanunciosLocationFromProfile(profile: any): Record<string, any> | null {
  if (!profile || typeof profile !== 'object') return null

  // /locations/current trae locality+province+geoLocation en la raíz.
  // No devolver solo geoLocation anidado: perderíamos los ids y el publish falla.
  if (
    looksLikeLocation(profile) &&
    (profile.locality?.id != null ||
      profile.province?.id != null ||
      profile.localityId != null ||
      profile.provinceId != null ||
      profile.geoLocation)
  ) {
    return profile
  }

  const nested = [
    profile.location,
    profile.address,
    profile.currentLocation,
    profile.data?.location,
  ]
  for (const candidate of nested) {
    if (looksLikeLocation(candidate)) return candidate
  }
  if (looksLikeLocation(profile)) return profile
  return null
}
