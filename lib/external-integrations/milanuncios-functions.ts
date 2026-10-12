import { validateListingRequiredFields, MissingFieldsError } from './validators'
import { runFlow, extractErrorMessage } from './extensionBridge'
import type { UploadResult } from '@/lib/external-integrations/validators'

export async function uploadMilanunciosItem(listing: any, accountId: string): Promise<UploadResult> {
  try {
    const missing = validateListingRequiredFields(listing, 'milanuncios')
    if (missing.length > 0) throw new MissingFieldsError(missing)

    const result = await runFlow('UPLOAD_MILANUNCIOS_ITEM', {
      listing,
      platform: 'milanuncios',
    })

    const state = result?.result?.state

    if (state?.maPublicationUrl || state?.maListingId) {
      const res = await fetch('/api/publications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId: state.maListingId,
          listingId: listing.id,
          platform: 'milanuncios',
          publicationUrl: state.maPublicationUrl,
          accountId,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.status !== 'success') {
        return {
          ok: false,
          message: data.message || 'Error guardando la publicación de Milanuncios',
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
      message: extractErrorMessage(result, 'No se pudo completar la publicación en Milanuncios'),
    }
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Error inesperado',
      missingFields: err instanceof MissingFieldsError ? err.fields : undefined,
    }
  }
}

export async function searchMilanunciosAccount() {
  try {
    const result = await runFlow('SEARCH_MILANUNCIOS_ACCOUNT', { platform: 'milanuncios' })

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
        message: 'No hay sesión de Milanuncios. Abre www.milanuncios.com e inicia sesión.',
      }
    }

    const res = await fetch('/api/accounts/milanuncios', {
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

export async function syncMilanunciosAccount(externalId: string) {
  try {
    const result = await runFlow('SYNC_MILANUNCIOS_ACCOUNT', {
      externalId,
      platform: 'milanuncios',
    })

    if (!result?.result?.state) {
      await fetch('/api/accounts/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId,
          syncStatus: 'ACCOUNT_NOT_FOUND',
          platform: 'milanuncios',
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
        platform: 'milanuncios',
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
        platform: 'milanuncios',
      }),
    })
    return {
      ok: false,
      message: err?.message || 'Error inesperado',
    }
  }
}
