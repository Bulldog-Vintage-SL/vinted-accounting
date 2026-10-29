import { runFlow } from './extensionBridge'
import { validateListingRequiredFields, MissingFieldsError } from './validators'
import type { UploadResult } from './validators'

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
