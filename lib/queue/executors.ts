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
  importWardrobe, importWallapopWardrobe, importVestiaireWardrobe,
  uploadItem, uploadWallapopItem, uploadVestiaireItem,
  deleteVintedItem, deleteWallapopItem, deleteVestiaireItem,
} from '@/lib/external-integrations'

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

// fetch con timeout para las llamadas a nuestros propios endpoints (Shopify),
// evita que un job se quede colgado en 'processing' para siempre y bloquee
// el lane de esa plataforma indefinidamente.
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
  } else {
    const res = await fetchWithTimeout(`/api/publications?id=${publication.id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Error al eliminar de BD')
  }
  return { deleted: true }
}

// Delete de un listing
const deleteExecutor: Executor<Listing> = async (job) => {
  await deleteListing(job.entity.id)
  return { deleted: true }
}

// Acciones masivas
export const executors: Record<JobAction, Executor<any>> = {
  upload: uploadExecutor,
  delete: deleteExecutor,
  import: importExecutor,
  deletePublication: deletePublicationExecutor,
}