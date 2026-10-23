import { extractErrorMessage, fetchFacebookImageAsBase64, runFlow } from './extensionBridge'
import { validateListingRequiredFields, MissingFieldsError } from './validators'
import type { UploadResult } from './validators'
import type { Listing } from '@/app/inventory/listings/types'
import { PLATFORM_PHOTO_LIMITS } from '@/app/inventory/listings/types'
import { transformImage } from '@/lib/images/imageTransform'
import { uploadPhoto } from '@/utils/uploadPhoto'
import { sleep } from '../utils'

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

export async function reuploadFacebookItem(
  accountId: string,
  listing: Listing,
  itemExternalId: string,
  publicationId: string
): Promise<UploadResult> {
  let oldPublicationDeleted = false

  try {
    const missing = validateListingRequiredFields(listing, 'facebook')
    if (missing.length) throw new MissingFieldsError(missing)

    const deleteResult = await deleteFacebookItem(itemExternalId, publicationId, accountId)
    if (!deleteResult.ok) {
      return {
        ok: false,
        message: `No se pudo eliminar la publicación anterior: ${deleteResult.message}`,
      }
    }
    oldPublicationDeleted = true

    const { modifiedListing, newTitle, newDescription } =
      await prepareFacebookListingForReupload(listing)

    await sleep(60_000)

    const uploadResult = await uploadFacebookItem(modifiedListing, accountId)
    if (!uploadResult.ok) {
      return {
        ...uploadResult,
        message: `La publicación anterior se eliminó, pero no se pudo volver a publicar en Facebook: ${uploadResult.message}`,
      }
    }

    return {
      ok: true,
      message: 'Publicación resubida correctamente en Facebook Marketplace',
      data: {
        listingId: listing.id,
        newTitle,
        newDescription,
        publication: uploadResult.data,
      },
    }
  } catch (error: any) {
    const errorMessage = error?.message || 'Error inesperado al resubir en Facebook Marketplace'
    const message = oldPublicationDeleted
      ? `La publicación anterior se eliminó, pero no se pudo completar la resubida: ${errorMessage}`
      : errorMessage

    if (error instanceof MissingFieldsError) {
      return { ok: false, message, missingFields: error.fields }
    }
    return {
      ok: false,
      message,
    }
  }
}

async function prepareFacebookListingForReupload(listing: Listing): Promise<{
  modifiedListing: Listing
  newTitle: string
  newDescription: string
}> {
  const selectedPhotos = listing.photoSelection?.facebook?.length
    ? listing.photoSelection.facebook
    : listing.photo_url
  const photoUrls = selectedPhotos.slice(0, PLATFORM_PHOTO_LIMITS.facebook)
  if (photoUrls.length === 0) {
    throw new Error('Facebook Marketplace necesita al menos una foto para resubir.')
  }

  const uploadedUrls = await Promise.all(
    photoUrls.map(async (url, index) => {
      try {
        const image = await fetchFacebookImageAsBase64(url)
        const binary = atob(image.base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const transformedImage = await transformImage(
          new Blob([bytes], { type: image.mime }),
        )
        return await uploadPhoto(
          new File([transformedImage], `${listing.id}_${index}.jpg`, {
            type: 'image/jpeg',
          }),
        )
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error desconocido'
        throw new Error(`No se pudo preparar la foto ${index + 1} para Facebook: ${message}`)
      }
    }),
  )

  let newTitle: string
  let newDescription: string
  try {
    const response = await fetch('/api/modify-texts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: listing.title,
        description: listing.description,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.message || data?.error || 'Error modificando título y descripción')
    }
    newTitle = data.title
    newDescription = data.description
    if (typeof newTitle !== 'string' || typeof newDescription !== 'string') {
      throw new Error('La respuesta de modificación de textos no contiene título y descripción válidos.')
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    throw new Error(`No se pudieron preparar el título y la descripción: ${message}`)
  }

  return {
    modifiedListing: {
      ...listing,
      photo_url: uploadedUrls,
      photoSelection: {
        ...listing.photoSelection,
        facebook: uploadedUrls,
      },
      title: newTitle,
      description: newDescription,
    },
    newTitle,
    newDescription,
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

export async function getFacebookItem(
  itemExternalId: string,
  externalId: string,
  publicationUrl?: string | null
) {
  try {
    let itemLookupId = itemExternalId
    if (publicationUrl) {
      try {
        const segments = new URL(publicationUrl).pathname.split('/').filter(Boolean)
        const itemIndex = segments.lastIndexOf('item')
        if (itemIndex >= 0 && segments[itemIndex + 1]) {
          itemLookupId = segments[itemIndex + 1]
        }
      } catch {
        throw new Error('La URL de la publicación de Facebook no es válida')
      }
    }

    const result = await runFlow('GET_FACEBOOK_ITEM', {
      itemExternalId,
      itemLookupId,
      externalId,
      platform: 'facebook',
    })
    if (!result?.ok || !result.result?.done) {
      return {
        ok: false,
        message: extractErrorMessage(result, 'Error al obtener la publicación de Facebook'),
      }
    }

    const item = result.result.state?.fbListingDetails
    if (!item) {
      return { ok: false, message: 'Facebook no devolvió los datos de la publicación' }
    }
    return { ok: true, item }
  } catch (error: any) {
    return {
      ok: false,
      message: error?.message || 'Error inesperado al obtener la publicación de Facebook',
    }
  }
}

export async function updateFacebookItem(
  itemExternalId: string,
  publicationId: string,
  externalId: string,
  fields: { title: string; description: string; price: number },
  item: Record<string, any>
) {
  try {
    const result = await runFlow('UPDATE_FACEBOOK_ITEM', {
      itemExternalId,
      externalId,
      fields,
      item,
      platform: 'facebook',
    })
    if (!result?.ok || !result.result?.done) {
      return {
        ok: false,
        message: extractErrorMessage(result, 'Error al actualizar la publicación de Facebook'),
      }
    }

    const patchResponse = await fetch(`/api/publications?id=${publicationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: fields.price }),
    })
    if (!patchResponse.ok) {
      const data = await patchResponse.json().catch(() => null)
      return {
        ok: false,
        message: data?.message ||
          'Publicación actualizada en Facebook, pero no se pudo sincronizar el precio en la base de datos',
      }
    }

    return {
      ok: true,
      message: 'Publicación actualizada correctamente en Facebook Marketplace',
    }
  } catch (error: any) {
    return {
      ok: false,
      message: error?.message || 'Error inesperado al actualizar en Facebook',
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
