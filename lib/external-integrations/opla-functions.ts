import { runFlow, extractErrorMessage } from './extensionBridge'
import { validateListingRequiredFields, MissingFieldsError } from './validators'
import type { UploadResult } from './validators'
import type { Listing } from '@/app/inventory/listings/types'
import { prepareListingForReupload } from './prepare-reupload'
import { sleep } from '../utils'

export async function searchOplaAccount() {
  try {
    const result = await runFlow('SEARCH_OPLA_ACCOUNT', { platform: 'opla' })

    if (!result?.result?.state) {
      return {
        ok: false,
        message: 'No se pudo obtener la cuenta desde la extensión',
      }
    }

    const { userId, accountName, profileLink } = result.result.state
    if (!userId) {
      return {
        ok: false,
        message: 'No hay sesión de Opla. Abre www.opla.co e inicia sesión.',
      }
    }

    const response = await fetch('/api/accounts/opla', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ externalId: userId, accountName, profileLink }),
    })
    const data = await response.json()

    if (!response.ok || data.status !== 'success') {
      return {
        ok: false,
        message: data.message || 'Error guardando la cuenta',
      }
    }

    return { ok: true, message: data.message, data }
  } catch (error: any) {
    return {
      ok: false,
      message: error?.message || 'Error inesperado',
    }
  }
}

export async function syncOplaAccount(externalId: string) {
  if (!externalId) {
    return { ok: false, message: 'ID de cuenta no válido' }
  }

  try {
    const result = await runFlow('SYNC_OPLA_ACCOUNT', {
      externalId,
      platform: 'opla',
    })
    const syncStatus = result?.result?.state?.syncStatus ?? 'ACCOUNT_NOT_FOUND'

    const response = await fetch('/api/accounts/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        externalId,
        syncStatus,
        platform: 'opla',
      }),
    })
    const data = await response.json()

    if (!response.ok || data.status !== 'success') {
      return {
        ok: false,
        message: data.message || 'Error guardando la cuenta',
      }
    }

    return { ok: true, message: data.message, data }
  } catch (error: any) {
    try {
      await fetch('/api/accounts/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId,
          syncStatus: 'ACCOUNT_NOT_FOUND',
          platform: 'opla',
        }),
      })
    } catch (syncError) {
      console.error('[Opla] No se pudo marcar la cuenta como no encontrada', syncError)
    }

    return {
      ok: false,
      message: error?.message || 'Error inesperado',
    }
  }

}

export async function importOplaWardrobe(accountId: string) {
  try {
    const accountResponse = await fetch(`/api/accounts/${accountId}`)
    const account = await accountResponse.json()
    if (!accountResponse.ok) {
      return { ok: false, message: account?.message || 'No se pudo obtener la cuenta de Opla' }
    }

    const result = await runFlow('IMPORT_OPLA_WARDROBE', {
      platform: 'opla',
      externalId: account.external_id ?? account.externalId,
    })
    const items = result?.result?.state?.items

    if (!Array.isArray(items)) {
      return { ok: false, message: 'Opla no devolvió productos para importar' }
    }

    const slimItems = items.map((item: any) => ({
      ...item,
      metadata: item.metadata ?? {},
    }))

    const response = await fetch('/api/listings/import/opla', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, wardrobe: slimItems }),
    })
    const data = await response.json()

    if (!response.ok || data.status !== 'success') {
      return { ok: false, message: data.message || 'Error importando productos de Opla' }
    }

    return { ok: true, message: data.message, data }
  } catch (error: any) {
    return { ok: false, message: error?.message || 'Error inesperado' }
  }
}

export async function uploadOplaItem(listing: any, accountId: string): Promise<UploadResult> {
  try {
    const missing = validateListingRequiredFields(listing, 'opla')
    if (missing.length) throw new MissingFieldsError(missing)

    const result = await runFlow('UPLOAD_OPLA_ITEM', {
      listing,
      platform: 'opla',
    })
    const state = result?.result?.state
    if (!state?.oplaArticleId) {
      return { ok: false, message: 'Opla no confirmó la publicación del artículo' }
    }

    const response = await fetch('/api/publications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        externalId: state.oplaArticleId,
        listingId: listing.id,
        platform: 'opla',
        publicationUrl: state.oplaPublicationUrl,
        accountId,
      }),
    })
    const data = await response.json()
    if (!response.ok || data.status !== 'success') {
      return { ok: false, message: data.message || 'Error guardando la publicación de Opla' }
    }

    return { ok: true, message: data.message, data }
  } catch (error: any) {
    return {
      ok: false,
      message: error?.message || 'Error inesperado',
      missingFields: error instanceof MissingFieldsError ? error.fields : undefined,
    }
  }
}

export async function reuploadOplaItem(
  accountId: string,
  listing: Listing,
  itemExternalId: string,
  publicationId: string
): Promise<UploadResult> {
  try {
    const missing = validateListingRequiredFields(listing, 'opla')
    if (missing.length) throw new MissingFieldsError(missing)

    const deleteResult = await deleteOplaItem(itemExternalId, publicationId)
    if (!deleteResult.ok) {
      return {
        ok: false,
        message: `No se pudo eliminar la publicación anterior: ${deleteResult.message}`,
      }
    }

    const { modifiedListing, newTitle, newDescription } =
      await prepareListingForReupload(listing)

    await sleep(60_000)

    const uploadResult = await uploadOplaItem(modifiedListing, accountId)
    if (uploadResult.ok === false) {
      return {
        ok: false,
        message: `Error al resubir el producto: ${uploadResult.message}`,
        missingFields: uploadResult.missingFields,
      }
    }

    return {
      ok: true,
      message: 'Publicación republicada correctamente en Opla',
      data: {
        listingId: listing.id,
        newTitle,
        newDescription,
        publication: uploadResult.data,
      },
    }
  } catch (error: any) {
    if (error instanceof MissingFieldsError) {
      return { ok: false, message: error.message, missingFields: error.fields }
    }
    return {
      ok: false,
      message: extractErrorMessage(error, 'Error inesperado'),
    }
  }
}

function getOplaArticle(result: any): any {
  return result?.result?.state?.oplaItemRaw
}

function getOplaPrice(article: any): number | null {
  const cents = article?.priceCents ?? article?.price_cents
  if (cents != null) return Number(cents) / 100
  if (article?.price != null) return Number(article.price)
  return null
}

export async function getOplaItem(itemExternalId: string) {
  try {
    const result = await runFlow('GET_OPLA_ITEM', {
      itemExternalId,
      platform: 'opla',
    })
    const article = getOplaArticle(result)

    if (!result?.ok || !article) {
      return { ok: false, message: 'Error al obtener el artículo de Opla' }
    }

    return {
      ok: true,
      item: {
        title: article.title ?? '',
        description: article.description ?? '',
        price: getOplaPrice(article),
      },
    }
  } catch (error: any) {
    return { ok: false, message: error?.message || 'Error inesperado' }
  }
}

export async function updateOplaItem(
  itemExternalId: string,
  publicationId: string,
  fields: { title: string; description: string; price: number }
) {
  try {
    const result = await runFlow('UPDATE_OPLA_ITEM', {
      itemExternalId,
      platform: 'opla',
      fields,
    })

    if (!result?.ok || !result.result?.state?.oplaUpdateDone) {
      return { ok: false, message: 'Opla no confirmó la actualización del artículo' }
    }

    const patchRes = await fetch(`/api/publications?id=${publicationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: fields.price }),
    })

    if (!patchRes.ok) {
      const errorData = await patchRes.json().catch((): null => null)
      return {
        ok: false,
        message: errorData?.message || 'Artículo actualizado en Opla, pero no se pudo sincronizar el precio en la base de datos',
      }
    }

    return { ok: true, message: 'Publicación actualizada correctamente en Opla' }
  } catch (error: any) {
    return { ok: false, message: error?.message || 'Error inesperado' }
  }
}

export async function deleteOplaItem(itemExternalId: string, publicationId: string) {
  try {
    const result = await runFlow('DELETE_OPLA_ITEM', {
      itemExternalId,
      platform: 'opla',
    })

    if (!result?.ok || !result.result?.state?.oplaDeleteDone) {
      return {
        ok: false,
        message: result?.result?.message || 'Opla no confirmó el borrado del artículo',
      }
    }

    const deleteRes = await fetch(`/api/publications?id=${publicationId}`, {
      method: 'DELETE',
    })

    if (!deleteRes.ok) {
      const errorData = await deleteRes.json().catch((): null => null)
      return {
        ok: false,
        message: errorData?.message || 'Artículo eliminado en Opla, pero no se pudo eliminar de la base de datos',
      }
    }

    return {
      ok: true,
      message: 'Publicación eliminada correctamente de Opla y de la base de datos',
    }
  } catch (error: any) {
    return { ok: false, message: error?.message || 'Error inesperado' }
  }
}
