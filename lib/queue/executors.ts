/*
  Ejecutores de cada una de las acciones disponibles para funciones masivas.
  Un job = una publicacion en una cuenta.
*/

import { deleteListing } from '@/app/inventory/listings/actions'
import { MissingFieldsError, isUploadFailure } from '@/lib/external-integrations/validators'
import type { Listing } from '@/app/inventory/listings/types'
import type { Publication } from '@/app/inventory/publications/types'
import type { Executor, JobAction } from './types'
import {
  importWardrobe, importWallapopWardrobe, importVestiaireWardrobe, importDepopWardrobe,
  uploadItem, uploadWallapopItem, uploadVestiaireItem, uploadDepopItem, uploadEbayItem,
  deleteVintedItem, deleteWallapopItem, deleteVestiaireItem, deleteDepopItem,
  reuploadVintedItem, reuploadWallapopItem, reuploadVestiaireItem, reuploadDepopItem,
  reuploadShopifyItem, reuploadEbayItem
} from '@/lib/external-integrations'

import {
  loadChatMessages, sendChatMessage, buildResponseContext,
  type ReplyChatEntity, type ReplyChatResult,
} from '@/lib/chats/chat-api'



// Entidad para upload
interface UploadEntity {
  listing: Listing
  account: { accountId: string; platform: string }
}

interface ImportEntity {
  accountId: string
  platform: string
}

const FETCH_TIMEOUT_MS = 15000

// eslint-disable-next-line no-undef
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`La petición a ${url} superó el tiempo límite (${timeoutMs}ms)`)
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

const importExecutor: Executor<ImportEntity> = async (job) => {
  const { accountId, platform } = job.entity

  if (platform === 'vinted') {
    const res = await importWardrobe(accountId)
    if (!res?.ok) throw new Error(`Vinted import: ${res?.message || 'Error desconocido'}`)
    return { imported: true, platform: 'vinted' }
  }
  else if (platform === 'wallapop') {
    const res = await importWallapopWardrobe(accountId)
    if (!res?.ok) throw new Error(`Wallapop import: ${res?.message || 'Error desconocido'}`)
    return { imported: true, platform: 'wallapop' }
  }
  else if (platform === 'vestiaire') {
    const res = await importVestiaireWardrobe(accountId)
    if (!res?.ok) throw new Error(`Vestiaire import: ${res?.message || 'Error desconocido'}`)
    return { imported: true, platform: 'vestiaire' }
  }
  else if (platform === 'shopify') {
    const res = await fetchWithTimeout('/api/shopify/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId }),
    })
    const data = await res.json()

    if (!res.ok || !data?.ok) {
      throw new Error(`Shopify import: ${data?.error || 'Error desconocido'}`)
    }

    if (data.errors?.length > 0) {
      console.warn('Errores parciales en import de Shopify:', data.errors)
    }

    return {
      imported: true,
      platform: 'shopify',
      created: data.created,
      updated: data.updated,
      total: data.total,
    }
  }
  else if (platform === 'depop') {
    const res = await importDepopWardrobe(accountId)
    if (!res?.ok) throw new Error(`Depop import: ${res?.message || 'Error desconocido'}`)
    return { imported: true, platform: 'depop' }
  }
  else if (platform === 'ebay') {
    const res = await fetchWithTimeout('/api/ebay/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId }),
    }, 120000)
    const data = await res.json()

    if (!res.ok || !data?.ok) {
      throw new Error(`eBay import: ${data?.error || 'Error desconocido'}`)
    }

    if (data.errors?.length > 0) {
      console.warn('Errores parciales en import de eBay:', data.errors)
    }

    return {
      imported: true,
      platform: 'ebay',
      created: data.created,
      updated: data.updated,
      total: data.total,
    }
  }
  else {
    throw new Error(`Plataforma no soportada: ${platform}`)
  }
}

// Upload a una cuenta en una plataforma
const uploadExecutor: Executor<UploadEntity> = async (job) => {
  const { listing, account } = job.entity

  if (account.platform === 'vinted') {
    const res = await uploadItem(listing, account.accountId)
    if (isUploadFailure(res)) {
      if (res.missingFields?.length) throw new MissingFieldsError(res.missingFields)
      throw new Error(`Vinted: ${res.message}`)
    }
    return { published: true, platform: 'vinted' }
  }
  else if (account.platform === 'wallapop') {
    const res = await uploadWallapopItem(listing, account.accountId)
    if (isUploadFailure(res)) {
      if (res.missingFields?.length) throw new MissingFieldsError(res.missingFields)
      throw new Error(`Wallapop: ${res.message}`)
    }
    return { published: true, platform: 'wallapop' }
  }
  else if (account.platform === 'vestiaire') {
    const res = await uploadVestiaireItem(listing, account.accountId)
    if (isUploadFailure(res)) {
      if (res.missingFields?.length) throw new MissingFieldsError(res.missingFields)
      throw new Error(`Vestiaire: ${res.message}`)
    }
    return { published: true, platform: 'vestiaire' }
  }
  else if (account.platform === 'shopify') {
    const res = await fetchWithTimeout('/api/shopify/upload-product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId: listing.id, accountId: account.accountId }),
    })
    const data = await res.json()

    if (!res.ok || !data?.ok) {
      throw new Error(`Shopify: ${data?.error || 'Error desconocido'}`)
    }

    return { published: true, platform: 'shopify', publication: data.publication }
  }
  else if (account.platform === 'depop') {
    const res = await uploadDepopItem(listing, account.accountId)
    if (isUploadFailure(res)) {
      if (res.missingFields?.length) throw new MissingFieldsError(res.missingFields)
      throw new Error(`Depop: ${res.message}`)
    }
    return { published: true, platform: 'depop' }
  }
  else if (account.platform === 'ebay') {
    const res = await uploadEbayItem(listing, account.accountId)
    if (isUploadFailure(res)) {
      if (res.missingFields?.length) throw new MissingFieldsError(res.missingFields)
      throw new Error(`eBay: ${res.message}`)
    }
    return { published: true, platform: 'ebay', publication: res.data }
  }
  else {
    throw new Error(`Plataforma no soportada: ${account.platform}`)
  }
}

const deletePublicationExecutor: Executor<Publication> = async (job) => {
  const publication = job.entity
  if (publication.platform === 'vinted') {
    const result = await deleteVintedItem(publication.external_id, publication.id)
    if (!result.ok) throw new Error(result.message || 'Error en Vinted')
  } else if (publication.platform === 'wallapop') {
    const result = await deleteWallapopItem(publication.external_id, publication.id)
    if (!result.ok) throw new Error(result.message || 'Error en Wallapop')
  } else if (publication.platform === 'vestiaire') {
    const result = await deleteVestiaireItem(publication.external_id, publication.id)
    if (!result.ok) throw new Error(result.message || 'Error en Vestiaire Collective')
  } else if (publication.platform === 'shopify') {
    const res = await fetchWithTimeout('/api/shopify/delete-product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicationId: publication.id }),
    })
    const data = await res.json()
    if (!res.ok || !data?.ok) {
      throw new Error(`Shopify: ${data?.error || 'Error desconocido'}`)
    }
  } else if (publication.platform === 'depop') {
    const result = await deleteDepopItem(publication.external_id, publication.id)
    if (!result.ok) throw new Error(result.message || 'Error en Depop')
  } else if (publication.platform === 'ebay') {
    const res = await fetchWithTimeout('/api/ebay/delete-product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicationId: publication.id }),
    })
    const data = await res.json()
    if (!res.ok || !data?.ok) {
      throw new Error(`eBay: ${data?.error || 'Error desconocido'}`)
    }
  } else {
    const res = await fetchWithTimeout(`/api/publications?id=${publication.id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Error al eliminar de BD')
  }
  return { deleted: true }
}

const reuploadPublicationExecutor: Executor<Publication> = async (job) => {
  const publication = job.entity

  if (!publication.listing_id) {
    throw new Error('No se encontró el producto asociado a esta publicación')
  }
  if (!publication.account_id) {
    throw new Error('Publicación sin cuenta asociada')
  }

  const resListing = await fetchWithTimeout(`/api/listings/${publication.listing_id}`, { method: 'GET' })
  if (!resListing.ok) {
    throw new Error('No se pudo cargar el producto para la resubida')
  }
  const listing: Listing = await resListing.json()

  if (publication.platform === 'vinted') {
    const result = await reuploadVintedItem(
      publication.account_id,
      listing,
      publication.external_id,
      publication.id
    )

    if (isUploadFailure(result)) {
      if (result.missingFields?.length) throw new MissingFieldsError(result.missingFields)
      throw new Error(result.message || 'Error en Vinted')
    }
    return { reuploaded: true, platform: 'vinted', data: result.data }
  } else if (publication.platform === 'wallapop') {
    const result = await reuploadWallapopItem(
      publication.account_id,
      listing,
      publication.external_id,
      publication.id
    )

    if (isUploadFailure(result)) {
      if (result.missingFields?.length) throw new MissingFieldsError(result.missingFields)
      throw new Error(result.message || 'Error en Wallapop')
    }
    return { reuploaded: true, platform: 'wallapop', data: result.data }
  } else if (publication.platform === 'vestiaire') {
    const result = await reuploadVestiaireItem(
      publication.account_id,
      listing,
      publication.external_id,
      publication.id
    )

    if (isUploadFailure(result)) {
      if (result.missingFields?.length) throw new MissingFieldsError(result.missingFields)
      throw new Error(result.message || 'Error en Vestiaire')
    }
    return { reuploaded: true, platform: 'vestiaire', data: result.data }
  } else if (publication.platform === 'depop') {
    const result = await reuploadDepopItem(
      publication.account_id,
      listing,
      publication.external_id,
      publication.id
    )

    if (isUploadFailure(result)) {
      if (result.missingFields?.length) throw new MissingFieldsError(result.missingFields)
      throw new Error(result.message || 'Error en Depop')
    }
    return { reuploaded: true, platform: 'depop', data: result.data }
  } else if (publication.platform === 'shopify') {
    const result = await reuploadShopifyItem(
      publication.account_id,
      listing,
      publication.id
    )

    if (isUploadFailure(result)) {
      if (result.missingFields?.length) throw new MissingFieldsError(result.missingFields)
      throw new Error(result.message || 'Error en Shopify')
    }
    return { reuploaded: true, platform: 'shopify', data: result.data }
  } else if (publication.platform === 'ebay') {
    const result = await reuploadEbayItem(
      publication.account_id,
      listing,
      publication.id
    )

    if (isUploadFailure(result)) {
      if (result.missingFields?.length) throw new MissingFieldsError(result.missingFields)
      throw new Error(result.message || 'Error en eBay')
    }
    return { reuploaded: true, platform: 'ebay', data: result.data }
  }
  else {
    throw new Error(`Resubida no soportada para "${publication.platform}"`)
  }
}


// Delete de un listing
const deleteExecutor: Executor<Listing> = async (job) => {
  await deleteListing(job.entity.id)
  return { deleted: true }
}

const replyChatExecutor: Executor<ReplyChatEntity> = async (job) => {
  const { chat, options } = job.entity
  if (chat.isOffer) throw new Error('Las ofertas no admiten respuesta por chat')

  // Siempre se recarga el hilo: contexto fresco y evita responder dos veces
  const loaded = await loadChatMessages(chat)
  if (!loaded.ok) throw new Error(loaded.message || 'No se pudo cargar la conversación')
  const messages = loaded.messages?.length ? loaded.messages : chat.messages

  const last = [...messages].reverse().find((m) => !m.systemEvent)
  if (!last) throw new Error('Conversación sin mensajes')

  if (last.isOwn && !options?.replyToOwn) {
    return { skipped: true, reason: 'El último mensaje ya es tuyo', messages } satisfies ReplyChatResult
  }

  const res = await fetchWithTimeout('/api/response-suggestions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      platform: chat.platform,
      contactName: chat.contactName,
      listingTitle: chat.listingTitle,
      messages: buildResponseContext(messages),
      followUp: Boolean(last.isOwn),
      instructions: options?.instructions,
    }),
  }, 60000)
  const data = await res.json()
  if (!res.ok || !data?.reply) throw new Error(`IA: ${data?.error || 'Sin respuesta'}`)

  const sent = await sendChatMessage(chat, data.reply)
  if (!sent.ok || !sent.sent) throw new Error(sent.message || 'No se pudo enviar el mensaje')

  return { replied: true, reply: data.reply, sent: sent.sent, messages } satisfies ReplyChatResult
}


// Acciones masivas
export const executors: Record<JobAction, Executor<any>> = {
  upload: uploadExecutor,
  delete: deleteExecutor,
  import: importExecutor,
  deletePublication: deletePublicationExecutor,
  reuploadPublication: reuploadPublicationExecutor,
  replyChat: replyChatExecutor
}