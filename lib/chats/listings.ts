/*
  Contexto de la prenda vinculada a un chat.
  - El mapper de cada plataforma da la referencia (barata, sin red).
  - Aquí se enriquece bajo demanda (solo al responder con IA) y con caché.
  Para añadir otra plataforma: rellenar su entrada en `enrichers`.
*/

import { getVintedItem } from '@/lib/external-integrations'
import type { ChatPlatform, ListingContext } from '@/app/chats/types'

type Enricher = (listing: ListingContext) => Promise<Partial<ListingContext> | null>

const enrichers: Partial<Record<ChatPlatform, Enricher>> = {
  vinted: async (l) => {
    // Lotes: nos quedamos con el título que ya trae la conversación
    if (!l.externalId || l.isBundle) return null
    const res = await getVintedItem(l.externalId)
    if (!res.ok || !res.item) return null
    return {
      title: res.item.title || l.title,
      description: res.item.description || undefined,
      price: res.item.price ?? l.price, // el precio actual manda sobre el de la transacción
    }
  },
  // wallapop, depop, vestiaire: pendientes
}

const TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { at: number; p: Promise<Partial<ListingContext> | null> }>()

// Nunca lanza: si falla el enriquecimiento se responde con lo que ya hay.
export async function resolveListing(listing?: ListingContext): Promise<ListingContext | undefined> {
  if (!listing?.externalId) return listing
  const enrich = enrichers[listing.platform]
  if (!enrich) return listing

  const key = `${listing.platform}:${listing.externalId}`
  let hit = cache.get(key)
  if (!hit || Date.now() - hit.at > TTL_MS) {
    const p = enrich(listing).catch((): null => null)
    const entry = { at: Date.now(), p }
    hit = entry
    cache.set(key, entry)
    // los fallos no se cachean
    void p.then((r) => {
      if (!r && cache.get(key) === entry) cache.delete(key)
    })
  }

  const extra = await hit.p
  return extra ? { ...listing, ...extra } : listing
}

// Lo que realmente viaja a /api/response-suggestions
export function toPromptListing(l?: ListingContext) {
  if (!l) return undefined
  const { title, description, price, currency, isBundle, userSide } = l
  if (!title && !description && price == null) return undefined
  return {
    title,
    description: description?.slice(0, 500),
    price,
    currency,
    isBundle,
    userSide,
  }
}