import { CONDITION_OPTIONS } from '@/lib/constants'
import stringSimilarity from 'string-similarity'

export const GRAILED_API_BASE = 'https://www.grailed.com'

const GRAILED_CONDITION_MAP: Record<typeof CONDITION_OPTIONS[number], string> = {
  Nuevo: 'is_new',
  'Como nuevo': 'is_gently_used',
  Bueno: 'is_gently_used',
  Aceptable: 'is_used',
}

const COLOR_MAP: Record<string, string> = {
  negro: 'Black',
  black: 'Black',
  gris: 'Gray',
  gray: 'Gray',
  grey: 'Gray',
  blanco: 'White',
  white: 'White',
  crema: 'Beige',
  beige: 'Beige',
  naranja: 'Orange',
  orange: 'Orange',
  coral: 'Orange',
  rojo: 'Red',
  red: 'Red',
  burdeos: 'Red',
  fucsia: 'Pink',
  rosa: 'Pink',
  pink: 'Pink',
  morado: 'Purple',
  purple: 'Purple',
  lila: 'Purple',
  azul: 'Blue',
  blue: 'Blue',
  navy: 'Blue',
  turquesa: 'Green',
  menta: 'Green',
  verde: 'Green',
  green: 'Green',
  caqui: 'Brown',
  marron: 'Brown',
  brown: 'Brown',
  mostaza: 'Yellow',
  amarillo: 'Yellow',
  yellow: 'Yellow',
  plateado: 'Silver',
  silver: 'Silver',
  dorado: 'Gold',
  gold: 'Gold',
  varios: 'Multi',
  multi: 'Multi',
}

const ITEM_TYPE_KEYWORDS: Record<string, string[]> = {
  camiseta: ['t_shirts', 't-shirts', 'tees', 'tank'],
  camisa: ['shirts', 'shirting', 'button'],
  polo: ['polos', 'polo'],
  sudadera: ['sweatshirts', 'hoodies', 'hoodies_and_zipups'],
  jersey: ['sweaters', 'knitwear', 'sweaters_and_knitwear'],
  pantalon: ['pants', 'trousers', 'casual_pants', 'formal_trousers'],
  vaquero: ['denim', 'jeans'],
  shorts: ['shorts', 'cropped'],
  bermuda: ['shorts'],
  chaqueta: ['jackets', 'light_jackets', 'denim_jackets', 'leather_jackets'],
  abrigo: ['coats', 'heavy_coats', 'parkas', 'outerwear'],
  vestido: ['dresses'],
  falda: ['skirts'],
  zapatilla: ['sneakers', 'hi_top_sneakers', 'low_top_sneakers'],
  zapato: ['shoes', 'formal_shoes', 'casual_leather_shoes'],
  bota: ['boots'],
  bolso: ['bags', 'bags_and_luggage'],
  sombrero: ['hats'],
  gorra: ['hats'],
  cap: ['hats'],
  hat: ['hats'],
  beanie: ['hats'],
  traje: ['suits', 'tailoring'],
  blazer: ['blazers'],
  accesorio: ['accessories'],
}

export function normalizeGrailedText(value: string | undefined | null): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .trim()
}

export function mapGrailedCondition(condition: string | undefined | null): string {
  const mapped = GRAILED_CONDITION_MAP[condition as typeof CONDITION_OPTIONS[number]]
  return mapped ?? 'is_gently_used'
}

export function mapGrailedColor(colors: string[] | undefined): string | null {
  const first = colors?.[0]
  if (!first) return null
  const key = normalizeGrailedText(first)
  return COLOR_MAP[key] ?? key.replace(/\s+/g, '_')
}

export function mapGrailedDepartment(gender: string | null | undefined): 'menswear' | 'womenswear' {
  return gender === 'mujer' ? 'womenswear' : 'menswear'
}

export function toGrailedCents(price: unknown): string {
  const n = Number(price)
  if (!Number.isFinite(n) || n <= 0) return '0'
  return String(Math.round(n * 100))
}

export function pickGrailedUserId(result: any): string {
  const id =
    result?.id ??
    result?.userId ??
    result?.user_id ??
    result?.data?.id ??
    result?.data?.user?.id ??
    result?.user?.id
  return id != null ? String(id) : ''
}

function asList(value: any): any[] {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.designers)) return value.designers
  if (Array.isArray(value?.results)) return value.results
  return []
}

function nodeChildren(node: any): any[] {
  return (
    node?.children ??
    node?.subcategories ??
    node?.categories ??
    node?.items ??
    []
  )
}

function flattenCategoryLeaves(
  nodes: any[],
  department: string,
  parentPath: string[]
): Array<{ id: string; name: string; path: string; department: string }> {
  const leaves: Array<{ id: string; name: string; path: string; department: string }> = []

  for (const node of nodes ?? []) {
    if (!node || typeof node !== 'object') continue

    const name = String(node.name ?? node.title ?? node.label ?? node.slug ?? '')
    const rawPath = node.path ?? node.category_path ?? node.categoryPath ?? node.slug
    const pathParts = rawPath
      ? String(rawPath).split('.').filter(Boolean)
      : [...parentPath, node.slug ?? node.name ?? ''].filter(Boolean)
    const children = nodeChildren(node)
    const nextDepartment =
      /women/i.test(String(node.department ?? node.name ?? department))
        ? 'womenswear'
        : /men/i.test(String(node.department ?? node.name ?? department))
          ? 'menswear'
          : department

    if (!children.length) {
      const path = (node.path ?? node.category_path ?? pathParts.join('.'))
        .toString()
        .replace(/^menswear\.|^womenswear\./, '')
      if (path.includes('.')) {
        leaves.push({
          id: String(node.id ?? path),
          name,
          path,
          department: nextDepartment,
        })
      }
      continue
    }

    leaves.push(...flattenCategoryLeaves(children, nextDepartment, pathParts))
  }

  return leaves
}

export function extractGrailedCategoryTree(result: any): any[] {
  const nested = result?.data?.categories ?? result?.categories
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return Object.entries(nested).map(([key, value]: [string, any]) => ({
      ...(value && typeof value === 'object' ? value : {}),
      name: value?.name ?? key,
      path: value?.path ?? key,
      subcategories: value?.subcategories ?? value?.children ?? [],
    }))
  }
  if (Array.isArray(nested)) return nested
  if (Array.isArray(result)) return result
  if (Array.isArray(result?.data)) return result.data
  return []
}

export function resolveGrailedCategory(
  categoriesResult: any,
  params: { gender?: string | null; itemType?: string | null; title?: string | null }
): { id: string; path: string; department: 'menswear' | 'womenswear'; name: string } {
  const department = mapGrailedDepartment(params.gender)
  const tree = extractGrailedCategoryTree(categoriesResult)
  const leaves = flattenCategoryLeaves(tree, department, [])
  const haystack = normalizeGrailedText(`${params.itemType ?? ''} ${params.title ?? ''}`)

  const keywords = Object.entries(ITEM_TYPE_KEYWORDS)
    .filter(([key]) => new RegExp(`(?:^|[^a-z0-9])${key}(?:$|[^a-z0-9])`).test(haystack))
    .flatMap(([, values]) => values)

  let best:
    | { id: string; path: string; department: string; name: string; score: number }
    | null = null

  for (const leaf of leaves) {
    const leafDept = /women/i.test(leaf.department) ? 'womenswear' : 'menswear'
    const pathNorm = normalizeGrailedText(leaf.path)
    const nameNorm = normalizeGrailedText(leaf.name)
    let score = 0

    if (leafDept === department) score += 0.4
    for (const kw of keywords) {
      const kwNorm = normalizeGrailedText(kw)
      if (pathNorm.includes(kwNorm) || nameNorm.includes(kwNorm)) score += 3
    }
    if (haystack && nameNorm) {
      score += stringSimilarity.compareTwoStrings(haystack, nameNorm)
    }
    if (haystack && pathNorm) {
      score += stringSimilarity.compareTwoStrings(haystack, pathNorm) * 0.6
    }

    if (!best || score > best.score) {
      best = { ...leaf, department: leafDept, score }
    }
  }

  if (best && String(best.path).includes('.') && best.score >= 1.5) {
    return {
      id: best.id,
      path: best.path,
      department: best.department === 'womenswear' ? 'womenswear' : 'menswear',
      name: best.name,
    }
  }

  return {
    id: best?.id ?? 'tops.short_sleeve_shirts',
    path: 'tops.short_sleeve_shirts',
    department,
    name: best?.name ?? 'Short Sleeve T-Shirts',
  }
}

export function pickGrailedDesignerIds(
  result: any,
  brand: string | undefined | null,
  title?: string | null
): number[] {
  const designers = asList(result)
  if (!designers.length) return []

  const targets = [brand, title]
    .filter(Boolean)
    .map((value) => normalizeGrailedText(String(value)))

  const scored = designers
    .map((d: any) => {
      const id = Number(d.id ?? d.designer_id ?? d.designerId)
      const name = String(d.name ?? d.slug ?? '')
      const nameNorm = normalizeGrailedText(name)
      if (!Number.isFinite(id) || nameNorm.length < 2 || nameNorm === '0') {
        return { id, name, score: -1 }
      }
      let score = 0
      for (const target of targets) {
        score = Math.max(score, stringSimilarity.compareTwoStrings(target, nameNorm))
        if (target.includes(nameNorm) || nameNorm.includes(target)) {
          score = Math.max(score, 0.85)
        }
      }
      return { id, name, score }
    })
    .filter((d: { score: number }) => d.score >= 0.5)
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score)

  return scored[0] ? [scored[0].id] : []
}

export function pickGrailedExactSize(
  result: any,
  sizeTitle: string | undefined | null
): { size: string | null; exactSize: string | null } {
  const size = (sizeTitle ?? '').trim() || null
  const options = asList(result)
    .concat(asList(result?.exact_sizes))
    .concat(asList(result?.sizes))
    .concat(asList(result?.data))

  if (!size || !options.length) {
    return { size, exactSize: null }
  }

  const target = normalizeGrailedText(size)
  const match = options.find((opt: any) => {
    const values = [opt.name, opt.title, opt.value, opt.label, opt.exact_size, opt.id]
      .filter(Boolean)
      .map((v: any) => normalizeGrailedText(String(v)))
    return values.some((v: string) => v === target || v.includes(target) || target.includes(v))
  })

  const exact =
    match?.exact_size ??
    match?.value ??
    match?.name ??
    match?.title ??
    match?.id ??
    null

  return { size, exactSize: exact != null ? String(exact) : null }
}

export function pickGrailedReturnAddressId(user: any): number | null {
  const payload = user?.data ?? user ?? {}
  const addresses =
    (Array.isArray(user) ? user : null) ??
    (Array.isArray(user?.data) ? user.data : null) ??
    (Array.isArray(payload?.data) ? payload.data : null) ??
    payload.postal_addresses ??
    payload.postalAddresses ??
    payload.addresses ??
    payload.return_addresses ??
    payload.returnAddresses ??
    []

  const list = Array.isArray(addresses) ? addresses : []
  const preferred =
    list.find((a: any) => a?.default || a?.is_default || a?.isDefault || a?.return || a?.default_return) ??
    payload.default_return_address ??
    payload.return_address ??
    list[0]

  const id = preferred?.id ?? payload.return_address_id ?? payload.returnAddressId
  const n = Number(id)
  return Number.isFinite(n) ? n : null
}

export function pickGrailedShipping(result: any): Record<string, any> {
  const payload = result?.data ?? result ?? {}
  if (payload.shipping && typeof payload.shipping === 'object') return payload.shipping
  if (payload.us || payload.eu || payload.uk) return payload

  const options = asList(payload.shipping_configs ?? payload.options ?? payload)
  if (options.length) {
    const shipping: Record<string, any> = {}
    for (const opt of options) {
      const region = String(opt.region ?? opt.zone ?? opt.code ?? opt.name ?? '').toLowerCase()
      if (!region) continue
      shipping[region] = {
        enabled: opt.enabled !== false,
        amount: Number(opt.amount ?? opt.price ?? opt.cost ?? 0),
        type: opt.type ?? undefined,
      }
    }
    if (Object.keys(shipping).length) return shipping
  }

  return {
    us: { enabled: true, amount: 30 },
    ca: { enabled: true, amount: 30 },
    uk: { enabled: true, amount: 15 },
    eu: { enabled: true, amount: 15 },
    asia: { enabled: true, amount: 25 },
    au: { enabled: true, amount: 20 },
    other: { enabled: true, amount: 50 },
  }
}

export function pickGrailedDraftId(result: any): string {
  const id =
    result?.id ??
    result?.data?.id ??
    result?.draft?.id ??
    result?.listing_draft?.id
  return id != null ? String(id) : ''
}

export function pickGrailedListing(result: any): { id: string; url: string } {
  const listing = result?.listing ?? result?.data?.listing ?? result?.data ?? result
  const id = listing?.id ?? listing?.listing_id ?? result?.id
  const slug = listing?.pretty_path ?? listing?.path ?? listing?.slug
  const url =
    listing?.url ??
    listing?.pretty_url ??
    (slug
      ? `https://www.grailed.com/${String(slug).replace(/^\//, '')}`
      : id
        ? `https://www.grailed.com/listings/${id}`
        : '')
  return { id: id != null ? String(id) : '', url }
}

export function buildGrailedDraftBody(s: {
  originalPayload?: any
  grailedCategoryPath?: string
  grailedDepartment?: 'menswear' | 'womenswear'
  grailedDesignerIds?: number[]
  grailedCondition?: string
  grailedColor?: string
  grailedSize?: string | null
  grailedExactSize?: string | null
  grailedPhotos?: any[]
  grailedReturnAddressId?: number | null
  grailedShipping?: Record<string, any>
}): Record<string, any> {
  const listing = s.originalPayload?.listing ?? {}
  const color = s.grailedColor || mapGrailedColor(listing.colors) || 'Black'
  const categoryPath = String(s.grailedCategoryPath || '').includes('.')
    ? s.grailedCategoryPath
    : 'tops.short_sleeve_shirts'
  const size = /accessories/.test(String(categoryPath))
    ? 'one size'
    : (s.grailedSize ?? listing.attributes?.size ?? 'l')
  const n = Number(listing.price)
  const price = String(Number.isFinite(n) && n > 0 ? Math.round(n) : 1)

  return {
    buynow: true,
    category_path: categoryPath,
    condition: s.grailedCondition || mapGrailedCondition(listing.condition),
    description: String(listing.description ?? ''),
    designers: (s.grailedDesignerIds ?? []).map((id) => ({ id })),
    duplicate_listing: false,
    hidden_from_algolia: false,
    makeoffer: true,
    measurements: [],
    photos: s.grailedPhotos ?? [],
    price,
    return_address_id: s.grailedReturnAddressId,
    shipping: s.grailedShipping && Object.keys(s.grailedShipping).length
      ? s.grailedShipping
      : pickGrailedShipping(null),
    shipping_label: {},
    size,
    styles: [],
    title: String(listing.title ?? ''),
    traits: [{ name: 'color', value: color }],
  }
}
