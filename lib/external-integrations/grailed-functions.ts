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
