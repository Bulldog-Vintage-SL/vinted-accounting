import type { WorkflowStep } from '../types'
import { PLATFORM_PHOTO_LIMITS } from '@/app/inventory/listings/types'
import { vintedToOplaCategory } from '@/lib/oplaCategoryMap'


const OPLA_API = 'https://www.opla.co/api/public'

function categoryHint(listing: any): string {
  const value = String(
    listing.attributes?.categoryPath ??
    listing.attributes?.category ??
    listing.item_type ??
    listing.title ??
    ''
  ).toLowerCase()

  if (/\b(zapato|zapatilla|bota|sandalia|shoe|sneaker|boot)\b/.test(value)) return 'shoe'
  if (/\b(bolso|mochila|cartera|bag|backpack)\b/.test(value)) return 'bag'
  if (/\b(abrigo|chaqueta|cazadora|coat|jacket)\b/.test(value)) return 'jacket'
  if (/\b(pantalon|vaquero|jean|falda|short|skirt|trouser)\b/.test(value)) return 'bottom'
  if (/\b(vestido|dress)\b/.test(value)) return 'dress'
  if (/\b(camisa|camiseta|jersey|sudadera|top|shirt|sweater|hoodie)\b/.test(value)) return 'top'
  if (/\b(accesorio|gafas|cinturon|gorra|sombrero|accessor|glasses|belt|hat)\b/.test(value)) return 'accessor'
  return value
}

export function buildOplaUploadSteps(listing: any): WorkflowStep[] {
  const photos = listing.photoSelection?.opla?.length
    ? listing.photoSelection.opla
    : (listing.photo_url ?? []).slice(0, PLATFORM_PHOTO_LIMITS.opla)

  if (!photos.length) throw new Error('Opla necesita al menos una foto.')

  const steps: WorkflowStep[] = [
    {
      id: crypto.randomUUID(),
      platform: 'opla',
      type: 'GET_OPLA_PROFILE',
      request: {
        url: `${OPLA_API}/me`,
        method: 'GET',
      },
    },
    {
      id: crypto.randomUUID(),
      platform: 'opla',
      type: 'GET_OPLA_CONFIG',
      request: {
        url: `${OPLA_API}/config/articles`,
        method: 'GET',
      },
    },
    {
      id: crypto.randomUUID(),
      platform: 'opla',
      type: 'GET_OPLA_BANNED_BRANDS',
      request: {
        url: 'https://www.opla.co/api/config/banned-brands',
        method: 'GET',
      },
    },
  ]

  steps.push(...photos.slice(0, PLATFORM_PHOTO_LIMITS.opla).map((photoUrl: string, index: number) => ({
    id: crypto.randomUUID(),
    platform: 'opla',
    type: 'UPLOAD_OPLA_IMAGE',
    request: {
      url: `${OPLA_API}/images/upload-url`,
      method: 'POST',
      isImageUpload: true,
      photoUrl,
      photoIndex: index,
      prefix: 'articles',
    },
  })))

  steps.push({
    id: crypto.randomUUID(),
    platform: 'opla',
    type: 'CREATE_OPLA_ARTICLE',
    request: {
      url: `${OPLA_API}/me/articles`,
      method: 'POST',
      body: {},
    },
  })

  return steps
}

export function mapOplaCategory(listing: any): string {
  return categoryHint(listing)
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function guessOplaCategory(listing: any, config: any): string {
  const roots = Array.isArray(config) ? config : config?.categories ?? []
  const leaves: any[] = []
  const visit = (nodes: any[]) => {
    for (const node of nodes) {
      if (!node?.code) continue
      if (Array.isArray(node.categories) && node.categories.length) visit(node.categories)
      else leaves.push(node)
    }
  }
  visit(roots)

  const explicit = String(
    listing.attributes?.oplaCategory ?? listing.attributes?.oplaCategoryCode ?? ''
  ).trim()
  if (explicit) {
    if (leaves.some((c) => c.code === explicit)) return explicit
    throw new Error(`La categoría de Opla "${explicit}" no existe o no es una categoría final.`)
  }

  const gender = normalize(String(listing.gender ?? ''))
  const prefix = gender === 'hombre' ? 'MEN_' : gender === 'mujer' ? 'WOMEN_' : null
  const pool = prefix ? leaves.filter((c) => c.code.startsWith(prefix)) : leaves

  const hint = normalize(categoryHint(listing))
  const titleText = normalize(String(listing.title ?? ''))
  const bodyText = normalize(
    [listing.attributes?.categoryPath, listing.attributes?.category, listing.item_type, listing.description]
      .filter(Boolean)
      .join(' ')
  )
  const tokens = (text: string) => new Set(text.split(/[^a-z0-9]+/).filter(Boolean))
  const titleTokens = tokens(titleText)
  const bodyTokens = tokens(bodyText)

  let best: { code: string; score: number } | null = null
  for (const category of pool) {
    const haystack = normalize(`${category.code} ${category.title ?? ''}`)
    const words = haystack.split(/[^a-z0-9]+/).filter((w) => w.length > 3)
    let score = hint && (haystack.includes(hint) || hint.includes(normalize(category.title ?? ''))) ? 10 : 0
    for (const word of words) {
      if (titleTokens.has(word)) score += 3
      else if (bodyTokens.has(word)) score += 1
    }
    if (!best || score > best.score) best = { code: category.code, score }
  }

  if (!best || best.score === 0) {
    throw new Error('No se pudo determinar la categoría de Opla. Indícala manualmente.')
  }
  return best.code
}

const collectLeaves = (config: any): Set<string> => {
  const leaves = new Set<string>()
  const visit = (nodes: any[]) => {
    for (const node of nodes) {
      if (!node?.code) continue
      if (Array.isArray(node.categories) && node.categories.length) visit(node.categories)
      else leaves.add(node.code)
    }
  }
  visit(Array.isArray(config) ? config : config?.categories ?? [])
  return leaves
}

export function resolveOplaCategory(listing: any, config: any): string {
  const leaves = collectLeaves(config)

  const explicit = String(
    listing.attributes?.oplaCategory ?? listing.attributes?.oplaCategoryCode ?? ''
  ).trim()
  if (explicit) {
    if (leaves.has(explicit)) return explicit
    throw new Error(`La categoría de Opla "${explicit}" no existe o no es una categoría final.`)
  }

  const catalogId =
    listing.catalog_id ?? listing.catalogId ?? listing.category_id ??
    listing.attributes?.catalog_id ?? listing.attributes?.catalogId
  const mapped = vintedToOplaCategory(catalogId)
  if (mapped && leaves.has(mapped)) return mapped

  return guessOplaCategory(listing, config)
}