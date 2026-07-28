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