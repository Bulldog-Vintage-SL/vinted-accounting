import { validateListingRequiredFields, MissingFieldsError } from './validators'
import { runFlow, extractErrorMessage } from './extensionBridge'
import type { UploadResult } from '@/lib/external-integrations/validators'

export async function uploadGrailedItem(listing: any, accountId: string): Promise<UploadResult> {
  try {
    const missing = validateListingRequiredFields(listing, 'grailed')
    if (missing.length > 0) throw new MissingFieldsError(missing)

    const result = await runFlow('UPLOAD_GRAILED_ITEM', {
      listing,
      platform: 'grailed',
    })

    const state = result?.result?.state

    if (state?.grailedPublicationUrl) {
      const res = await fetch('/api/publications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId: state.grailedListingId,
          listingId: listing.id,
          platform: 'grailed',
          publicationUrl: state.grailedPublicationUrl,
          accountId,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.status !== 'success') {
        return {
          ok: false,
          message: data.message || 'Error guardando la publicación de Grailed',
        }
      }

      return {
        ok: true,
        message: data.message,
        data,
      }
    }

    return {
      ok: false,
      message: extractErrorMessage(result, 'No se pudo completar la publicación en Grailed'),
    }
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Error inesperado',
      missingFields: err instanceof MissingFieldsError ? err.fields : undefined,
    }
  }
}

export async function searchGrailedAccount() {
  try {
    const result = await runFlow('SEARCH_GRAILED_ACCOUNT', { platform: 'grailed' })

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
        message: 'No hay sesión de Grailed. Abre www.grailed.com e inicia sesión.',
      }
    }

    const res = await fetch('/api/accounts/grailed', {
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

export async function syncGrailedAccount(externalId: string) {
  try {
    const result = await runFlow('SYNC_GRAILED_ACCOUNT', { externalId, platform: 'grailed' })
    if (!result?.result?.state) {
      await fetch('/api/accounts/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId,
          syncStatus: 'ACCOUNT_NOT_FOUND',
          platform: 'grailed',
        }),
      })
      return {
        ok: false,
        message: 'No se pudo obtener la cuenta desde la extensión',
      }
    }

    const { syncStatus } = result.result.state

    const res = await fetch('/api/accounts/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        externalId,
        syncStatus,
        platform: 'grailed',
      }),
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
    await fetch('/api/accounts/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        externalId,
        syncStatus: 'ACCOUNT_NOT_FOUND',
        platform: 'grailed',
      }),
    })
    return {
      ok: false,
      message: err?.message || 'Error inesperado',
    }
  }
}

export async function importGrailedWardrobe(accountId: string) {
  try {
    const resAcc = await fetch(`/api/accounts/${accountId}`)
    const account = await resAcc.json()
    const externalId = (account.external_id ?? account.externalId)?.toString()

    if (!externalId) {
      return { ok: false, message: 'La cuenta de Grailed no tiene id de usuario' }
    }

    const result = await runFlow('IMPORT_GRAILED_WARDROBE', {
      externalId,
      platform: 'grailed',
    })

    const items = result?.result?.state?.items
    if (!items) {
      return { ok: false, message: 'No se pudieron obtener los artículos de Grailed' }
    }

    const slimItems = items.map((item: any) => ({
      id: item.id ?? item.listing_id,
      title: item.title ?? item.name,
      description: item.description ?? '',
      price: item.price ?? item.price_i ?? item.sold_price,
      size: item.size ?? item.pretty_size,
      condition: item.condition,
      designers: (item.designers ?? []).map((d: any) => ({
        id: d.id,
        name: d.name,
      })),
      photos: (item.photos ?? item.images ?? []).map((photo: any) => ({
        url: photo?.url ?? photo?.image_url ?? photo,
      })),
      coverPhoto: item.cover_photo?.url ?? item.cover_photo ?? item.photo_url,
      sold: Boolean(item.sold),
      slug: item.pretty_path ?? item.path ?? item.slug,
    }))

    const BATCH_SIZE = 25
    let lastData: any = null

    for (let i = 0; i < slimItems.length; i += BATCH_SIZE) {
      const batch = slimItems.slice(i, i + BATCH_SIZE)
      const resApi = await fetch('/api/listings/import/grailed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          wardrobe: batch,
          timestamp: Date.now(),
        }),
      })
      const data = await resApi.json()
      if (!resApi.ok || data.status !== 'success') {
        return { ok: false, message: data.message || 'Error guardando artículos de Grailed' }
      }
      lastData = data
    }

    return {
      ok: true,
      message: lastData?.message ?? 'Armario importado correctamente',
      data: lastData,
    }
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Error inesperado',
    }
  }
}
