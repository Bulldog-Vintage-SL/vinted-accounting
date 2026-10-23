import { extractErrorMessage, fetchFacebookImageAsBase64, runFlow } from './extensionBridge'
import { validateListingRequiredFields, MissingFieldsError } from './validators'
import type { UploadResult } from './validators'

export async function searchFacebookAccount() {
  try {
    const result = await runFlow('SEARCH_FACEBOOK_ACCOUNT', { platform: 'facebook' })
    const state = result?.result?.state

    if (!state) {
      return {
        ok: false,
        message: 'No se pudo obtener la cuenta desde la extensión',
      }
    }

    const userId = state.userId
    if (!userId) {
      return {
        ok: false,
        message: 'No hay sesión de Facebook. Abre www.facebook.com e inicia sesión.',
      }
    }

    const accountName = state.accountName
    const profileLink = state.profileLink ?? `https://www.facebook.com/profile.php?id=${userId}`
    const res = await fetch('/api/accounts/facebook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ externalId: userId, accountName, profileLink }),
    })
    const data = await res.json()

    if (!res.ok || data.status !== 'success') {
      return {
        ok: false,
        message: data.message || 'Error guardando la cuenta',
      }
    }

    return {
      ok: true,
      message: data.message,
      data,
    }
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Error inesperado',
    }
  }
}

export async function syncFacebookAccount(externalId: string) {
  try {
    const result = await runFlow('SYNC_FACEBOOK_ACCOUNT', {
      externalId,
      platform: 'facebook',
    })
    const state = result?.result?.state

    if (!state) {
      await fetch('/api/accounts/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId,
          syncStatus: 'ACCOUNT_NOT_FOUND',
          platform: 'facebook',
        }),
      })
      return {
        ok: false,
        message: 'No se pudo obtener la cuenta desde la extensión',
      }
    }

    const res = await fetch('/api/accounts/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        externalId,
        syncStatus: state.syncStatus,
        platform: 'facebook',
      }),
    })
    const data = await res.json()

    if (!res.ok || data.status !== 'success') {
      return {
        ok: false,
        message: data.message || 'Error sincronizando la cuenta',
      }
    }

    return {
      ok: true,
      message: data.message,
      data,
    }
  } catch (err: any) {
    await fetch('/api/accounts/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        externalId,
        syncStatus: 'ACCOUNT_NOT_FOUND',
        platform: 'facebook',
      }),
    })
    return {
      ok: false,
      message: err?.message || 'Error inesperado',
    }
  }
}

export async function uploadFacebookItem(
  listing: any,
  accountId: string
): Promise<UploadResult> {
  try {
    const missing = validateListingRequiredFields(listing, 'facebook')
    if (missing.length) throw new MissingFieldsError(missing)

    const accountResponse = await fetch(`/api/accounts/${accountId}`)
    const account = await accountResponse.json()
    if (!accountResponse.ok) {
      throw new Error(account.message || account.error || 'No se pudo cargar la cuenta de Facebook')
    }
    const externalId = (account.external_id ?? account.externalId)?.toString()
    if (!externalId) throw new Error('La cuenta de Facebook no tiene id de vendedor')

    const result = await runFlow('UPLOAD_FACEBOOK_ITEM', {
      listing,
      platform: 'facebook',
      externalId,
    })
    const state = result?.result?.state
    if (!state?.fbListingId) {
      return {
        ok: false,
        message: extractErrorMessage(
          result,
          'Facebook no devolvió el id de la publicación creada'
        ),
      }
    }

    const response = await fetch('/api/publications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        externalId: state.fbListingId,
        listingId: listing.id,
        platform: 'facebook',
        publicationUrl: state.fbPublicationUrl,
        accountId,
      }),
    })
    const data = await response.json()
    if (!response.ok || data.status !== 'success') {
      return {
        ok: false,
        message: data.message || 'Error guardando la publicación de Facebook',
      }
    }

    return {
      ok: true,
      message: 'Facebook ha recibido el anuncio; puede quedar pendiente de revisión antes de mostrarse.',
      data,
    }
  } catch (error: any) {
    return {
      ok: false,
      message: error?.message || 'Error inesperado al publicar en Facebook',
      missingFields: error instanceof MissingFieldsError ? error.fields : undefined,
    }
  }
}

export async function deleteFacebookItem(
  itemExternalId: string,
  publicationId: string,
  accountId: string
) {
  try {
    const accountResponse = await fetch(`/api/accounts/${accountId}`)
    const account = await accountResponse.json()
    if (!accountResponse.ok) {
      throw new Error(account.message || account.error || 'No se pudo cargar la cuenta de Facebook')
    }

    const externalId = (account.external_id ?? account.externalId)?.toString()
    if (!externalId) throw new Error('La cuenta de Facebook no tiene id de vendedor')

    const result = await runFlow('DELETE_FACEBOOK_ITEM', {
      itemExternalId,
      externalId,
      platform: 'facebook',
    })
    if (!result?.ok || !result.result?.done) {
      return {
        ok: false,
        message: extractErrorMessage(result, 'Error al eliminar la publicación de Facebook'),
      }
    }

    const deleteResponse = await fetch(`/api/publications?id=${publicationId}`, {
      method: 'DELETE',
    })
    if (!deleteResponse.ok) {
      const data = await deleteResponse.json()
      return {
        ok: false,
        message: data.message || 'Error al eliminar el registro en la base de datos',
      }
    }

    return {
      ok: true,
      message: 'Publicación eliminada correctamente de Facebook y de la BD',
    }
  } catch (error: any) {
    return {
      ok: false,
      message: error?.message || 'Error inesperado al eliminar en Facebook',
    }
  }
}

export async function importFacebookWardrobe(accountId: string) {
  try {
    const accountResponse = await fetch(`/api/accounts/${accountId}`)
    const account = await accountResponse.json()
    if (!accountResponse.ok) {
      return {
        ok: false,
        message: account.message || account.error || 'No se pudo cargar la cuenta de Facebook',
      }
    }

    const externalId = (account.external_id ?? account.externalId)?.toString()
    if (!externalId) {
      return { ok: false, message: 'La cuenta de Facebook no tiene id de vendedor' }
    }

    const result = await runFlow('IMPORT_FACEBOOK_WARDROBE', {
      externalId,
      platform: 'facebook',
    })
    const items = result?.result?.state?.items
    if (!Array.isArray(items)) {
      const flowError = result?.result?.error ?? result?.error
      return {
        ok: false,
        message: typeof flowError === 'string'
          ? flowError
          : 'No se pudieron obtener las publicaciones de Facebook',
      }
    }

    const slimItems = items.map((item: any) => ({
      id: item.id,
      marketplace_listing_title: item.marketplace_listing_title ?? item.title,
      condition: item.condition,
      brand: item.brand,
      size: item.size,
      description: typeof item.description === 'object'
        ? { text: item.description?.text ?? '' }
        : item.description ?? '',
      listing_price: {
        amount: item.listing_price?.amount,
        formatted_amount: item.listing_price?.formatted_amount,
      },
      strikethrough_price: item.strikethrough_price,
      marketplace_listing_category_id: item.marketplace_listing_category_id,
      marketplace_listing_seller: {
        name: item.marketplace_listing_seller?.name,
      },
      attribute_data_json: item.attribute_data_json,
      is_hidden: item.is_hidden,
      is_live: item.is_live,
      is_pending: item.is_pending,
      is_sold: item.is_sold,
      photoUrl: item.primary_listing_photo?.image?.uri,
      delivery_types: item.delivery_types,
      location: {
        reverse_geocode: {
          city: item.location?.reverse_geocode?.city,
          state: item.location?.reverse_geocode?.state,
        },
      },
      story: { url: item.story?.url },
    }))

    const totals = { created: 0, alreadyImported: 0, blockedByOtherUser: 0 }
    for (const item of slimItems) {
      const photo = typeof item.photoUrl === 'string' && item.photoUrl.trim()
        ? await fetchFacebookImageAsBase64(item.photoUrl)
        : null
      const { photoUrl, ...itemWithoutUrl } = item
      const response = await fetch('/api/listings/import/facebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          wardrobe: [{
            ...itemWithoutUrl,
            photoBase64: photo ? `data:${photo.mime};base64,${photo.base64}` : null,
          }],
        }),
      })
      const data = await response.json()
      if (!response.ok || data.status !== 'success') {
        return {
          ok: false,
          message: data.message || 'Error guardando las publicaciones de Facebook',
        }
      }
      totals.created += data.created ?? 0
      totals.alreadyImported += data.alreadyImported ?? 0
      totals.blockedByOtherUser += data.blockedByOtherUser ?? 0
    }

    const summary = [`${totals.created} importados`]
    if (totals.alreadyImported) summary.push(`${totals.alreadyImported} ya existentes`)
    if (totals.blockedByOtherUser) {
      summary.push(`${totals.blockedByOtherUser} vinculados a otro usuario`)
    }

    return {
      ok: true,
      message: slimItems.length
        ? `Publicaciones de Facebook procesadas: ${summary.join(', ')}`
        : 'No hay publicaciones nuevas que importar',
      data: totals,
    }
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Error inesperado',
    }
  }
}
