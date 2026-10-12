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

function scoreCategory(
  entry: { node: CategoryNode; path: CategoryNode[] },
  gender: string | null | undefined,
  itemType: string | null | undefined,
  title: string | null | undefined
): number {
  const hay = [...entry.path.map((p) => p.name), entry.node.name, ...(entry.node.synonyms || [])]
    .join(' ')
    .toLowerCase()
  const type = String(itemType || '').toLowerCase()
  const titleText = String(title || '').toLowerCase()
  const g = String(gender || '').toLowerCase()

  let score = 0
  if (!hay.includes('moda')) return -100

  if (g.includes('mujer') || g === 'female' || g === 'f') {
    if (hay.includes('mujer')) score += 8
    if (hay.includes('hombre')) score -= 4
  } else if (g.includes('hombre') || g === 'male' || g === 'm') {
    if (hay.includes('hombre')) score += 8
    if (hay.includes('mujer')) score -= 4
  }

  const keywords: Array<[RegExp, number]> = [
    [/polo/, 12],
    [/camiset/, 10],
    [/camis/, 8],
    [/pantal/, 10],
    [/jeans|vaquer/, 10],
    [/zapatill|sneaker|deportiv/, 10],
    [/zapato|calzado|bota/, 9],
    [/abrigo|chaqueta|cazadora|sudadera/, 8],
    [/vestido/, 10],
    [/falda/, 10],
    [/complement|bolso|cintur|gorra|bufanda/, 7],
    [/ropa/, 3],
  ]

  for (const [re, pts] of keywords) {
    if (re.test(type) || re.test(titleText)) {
      if (re.test(hay) || (re.source.includes('calzado') && hay.includes('calzado'))) {
        score += pts
      }
    }
  }

  // Prefer leaf nodes
  if (!entry.node.children?.length) score += 2
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

export function mapMilanunciosCondition(condition: string | null | undefined): string {
  const c = String(condition || '').toLowerCase()
  if (c.includes('nuevo con etiqueta') || c.includes('new with tags')) return 'new'
  if (c.includes('nuevo') || c.includes('new')) return 'as_new'
  if (c.includes('muy buen') || c.includes('excellent') || c.includes('like new')) return 'good'
  if (c.includes('aceptable') || c.includes('fair') || c.includes('worn')) return 'fair'
  return 'good'
}

export function mapMilanunciosColor(colors: string[] | undefined): string | null {
  const first = String(colors?.[0] || '').toLowerCase().trim()
  if (!first) return null
  const map: Record<string, string> = {
    negro: 'negro',
    black: 'negro',
    blanco: 'blanco',
    white: 'blanco',
    gris: 'gris',
    gray: 'gris',
    grey: 'gris',
    azul: 'azul',
    blue: 'azul',
    rojo: 'rojo',
    red: 'rojo',
    verde: 'verde',
    green: 'verde',
    amarillo: 'amarillo',
    yellow: 'amarillo',
    naranja: 'naranja',
    orange: 'naranja',
    rosa: 'lila',
    pink: 'lila',
    morado: 'violeta',
    purple: 'violeta',
    marron: 'marron',
    marrón: 'marron',
    brown: 'marron',
    beige: 'beige',
    dorado: 'dorado',
    gold: 'dorado',
    plata: 'plata',
    silver: 'plata',
    multicolor: 'multicolor',
  }
  return map[first] || first.normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

export function buildMilanunciosDraftBody(state: {
  maCategoryId?: string
  maFormId?: string
  maUserId?: string
  maDraftId?: string
  maLocation?: Record<string, any> | null
  originalPayload?: any
}): Record<string, any> {
  const listing = state.originalPayload?.listing || {}
  const price = Number(listing.price)
  const body: Record<string, any> = {
    id: state.maDraftId || undefined,
    categoryId: String(state.maCategoryId || ''),
    formId: state.maFormId || undefined,
    transactionType: 'OFFER',
    title: String(listing.title || '').slice(0, 70),
    description: String(listing.description || ''),
    price: Number.isFinite(price) ? price : undefined,
    currency: 'EUR',
    status: 'DRAFT',
    attributes: {
      brand: listing.attributes?.brand || undefined,
      size: listing.attributes?.size || undefined,
      condition: mapMilanunciosCondition(listing.condition),
      color: mapMilanunciosColor(listing.colors) || undefined,
    },
    contact: {
      userId: state.maUserId ? String(state.maUserId) : undefined,
    },
  }

  if (state.maLocation) {
    body.location = state.maLocation
  }

  return body
}

export function buildMilanunciosPublishBody(state: {
  maDraftId?: string
  maCategoryId?: string
  maUserId?: string
}): Record<string, any> {
  return {
    id: state.maDraftId,
    draftId: state.maDraftId,
    categoryId: state.maCategoryId,
    userId: state.maUserId,
    transactionType: 'OFFER',
  }
}

export function pickMilanunciosUserId(result: any): string | null {
  const id =
    result?.userId ??
    result?.id ??
    result?.user?.id ??
    result?.profile?.userId ??
    result?.data?.userId ??
    result?.data?.id
  return id != null ? String(id) : null
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

export function pickMilanunciosLocationFromProfile(profile: any): Record<string, any> | null {
  const loc =
    profile?.location ??
    profile?.address ??
    profile?.geoLocation ??
    profile?.data?.location
  if (!loc) return null
  return loc
}
