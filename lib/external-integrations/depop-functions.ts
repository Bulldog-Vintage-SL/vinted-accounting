import { validateListingRequiredFields, MissingFieldsError } from './validators'
import { runFlow } from './extensionBridge'
import type { UploadResult } from '@/lib/external-integrations/validators'

// Buscar cuenta de Depop (primera vez, guarda el externalId detectado)
export async function searchDepopAccount() {
    try {
        const result = await runFlow("SEARCH_DEPOP_ACCOUNT", { platform: 'depop' });

        if (!result?.result?.state) {
            return {
                ok: false,
                message: "No se pudo obtener la cuenta desde la extensión",
            };
        }

        const { userId, username, profileLink } = result.result.state;

        const res = await fetch("/api/accounts/depop", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ externalId: userId, accountName: username, profileLink }),
        });

        const data = await res.json();

        if (!res.ok || data.status !== "success") {
            return {
                ok: false,
                message: data.message || "Error guardando la cuenta",
            };
        }

        return {
            ok: true,
            message: data.message,
            data,
        };

    } catch (err: any) {
        return {
            ok: false,
            message: err?.message || "Error inesperado",
        };
    }
}

// Sincronizar cuenta de Depop (verifica que la pestaña abierta es la cuenta guardada)
export async function syncDepopAccount(externalId: string) {
    try {

        const result = await runFlow('SYNC_DEPOP_ACCOUNT', { externalId, platform: 'depop' });
        if (!result?.result?.state) {
            await fetch('/api/accounts/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ externalId, syncStatus: 'ACCOUNT_NOT_FOUND', platform: 'depop' })
            });
            return {
                ok: false,
                message: "No se pudo obtener la cuenta desde la extensión",
            };
        }

        const { syncStatus } = result.result.state
        console.log(syncStatus)

        const res = await fetch('/api/accounts/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                externalId,
                syncStatus,
                platform: 'depop'
            })
        })

        const data = await res.json();

        if (!res.ok || data.status !== "success") {
            return {
                ok: false,
                message: data.message || "Error guardando la cuenta",
            };
        }

        return {
            ok: true,
            message: data.message,
            data,
        };

    } catch (err: any) {
        await fetch('/api/accounts/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ externalId, syncStatus: 'ACCOUNT_NOT_FOUND', platform: 'depop' })
        });
        return {
            ok: false,
            message: err?.message || "Error inesperado",
        };
    }
}

// Importar productos de Depop
export async function importDepopWardrobe(userId: string) {

  try {

    // Primero obtenemos el id de la cuenta de depop correspondiente a userId
    const res = await fetch(`/api/accounts/${userId}`);
    const account = await res.json();
    const externalId = (account.external_id ?? account.externalId)?.toString();

    // Iniciamos el workflow en la extension con el id pertinente
    const result = await runFlow('IMPORT_DEPOP_WARDROBE', { externalId });

    if (result?.result?.state?.items) {

      const items = result.result.state.items;

      // Importamos los articulos que se nos han devuelto
      const resApi = await fetch('/api/listings/import/depop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: userId,
          wardrobe: items,
          timestamp: Date.now()
        })
      });

      const data = await resApi.json();

      if (!resApi.ok || data.status !== "success") {
        return {
          ok: false,
          message: data.message || "Error guardando la cuenta",
        };
      }

      return {
        ok: true,
        message: data.message,
        data,
      };

    }

  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || "Error inesperado",
    };
  }

}