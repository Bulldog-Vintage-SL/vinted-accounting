import { validateListingRequiredFields, MissingFieldsError } from './validators'
import { runFlow, extractErrorMessage } from './extensionBridge'
import type { UploadResult } from '@/lib/external-integrations/validators'

export async function uploadTodocoleccionItem(listing: any, accountId: string): Promise<UploadResult> {
  try {
    const missing = validateListingRequiredFields(listing, 'todocoleccion')
    if (missing.length > 0) throw new MissingFieldsError(missing)

    const result = await runFlow('UPLOAD_TODOCOLECCION_ITEM', {
      listing,
      platform: 'todocoleccion',
    })

    const state = result?.result?.state

    if (state?.tcPublicationUrl || state?.tcListingId) {
      const res = await fetch('/api/publications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId: state.tcListingId,
          listingId: listing.id,
          platform: 'todocoleccion',
          publicationUrl: state.tcPublicationUrl,
          accountId,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.status !== 'success') {
        return {
          ok: false,
          message: data.message || 'Error guardando la publicación de todocoleccion',
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
      message: extractErrorMessage(result, 'No se pudo completar la publicación en todocoleccion'),
    }
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Error inesperado',
      missingFields: err instanceof MissingFieldsError ? err.fields : undefined,
    }
  }
}

export async function searchTodocoleccionAccount() {
  try {
    const result = await runFlow('SEARCH_TODOCOLECCION_ACCOUNT', { platform: 'todocoleccion' })

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
        message: 'No hay sesión de todocoleccion. Abre www.todocoleccion.net/mitc e inicia sesión.',
      }
    }

    const res = await fetch('/api/accounts/todocoleccion', {
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

export async function syncTodocoleccionAccount(externalId: string) {
  try {
    const result = await runFlow('SYNC_TODOCOLECCION_ACCOUNT', {
      externalId,
      platform: 'todocoleccion',
    })
    if (!result?.result?.state) {
      await fetch('/api/accounts/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId,
          syncStatus: 'ACCOUNT_NOT_FOUND',
          platform: 'todocoleccion',
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
        platform: 'todocoleccion',
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
        platform: 'todocoleccion',
      }),
    })
    return {
      ok: false,
      message: err?.message || 'Error inesperado',
    }
  }
}
