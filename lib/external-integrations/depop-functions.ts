import { validateListingRequiredFields, MissingFieldsError } from './validators'
import { runFlow } from './extensionBridge'
import type { UploadResult } from '@/lib/external-integrations/validators'

// Publicar en Depop
export async function uploadDepopItem(listing: any, accountId: string): Promise<UploadResult> {

    try {

        const missing = validateListingRequiredFields(listing, 'depop')
        if (missing.length > 0) throw new MissingFieldsError(missing)

        const result = await runFlow('UPLOAD_DEPOP_ITEM', {
            platform: 'depop',
            listing
        });

        const state = result?.result?.state;

        if (state?.depopPublicationUrl) {

            const res = await fetch('/api/publications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    externalId: state.depopProductId,
                    listingId: listing.id,
                    platform: 'depop',
                    publicationUrl: state.depopPublicationUrl,
                    accountId: accountId
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
        }

        return { ok: false, message: "No se pudo completar la publicación en Depop" };

    } catch (err: any) {
        return {
            ok: false,
            message: err?.message || "Error inesperado",
            missingFields: err instanceof MissingFieldsError ? err.fields : undefined,
        };
    }

}

// Buscar cuenta de Depop
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

// Sincronizar cuenta de Depop
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

// Borrar publicacion en Depop
export async function deleteDepopItem(itemExternalId: string, publicationId: string) {
    try {
        const result = await runFlow('DELETE_DEPOP_ITEM', { externalId: itemExternalId, platform: 'depop' });

        if (!result || !result.ok || !result.result?.done) {
            const errorMsg = result?.result?.result?.message || result?.result?.message || 'Error al eliminar en Depop';
            return { ok: false, message: errorMsg };
        }

        const deleteRes = await fetch(`/api/publications?id=${publicationId}`, {
            method: 'DELETE',
        });

        if (!deleteRes.ok) {
            const errorData = await deleteRes.json();
            return {
                ok: false,
                message: errorData.message || 'Error al eliminar el registro en la base de datos',
            };
        }

        return {
            ok: true,
            message: 'Publicación eliminada correctamente de Depop y de la BD',
        };

    } catch (err: any) {
        return {
            ok: false,
            message: err?.message || 'Error inesperado',
        };
    }
}

export async function getDepopItem(slug: string) {
    try {
        const result = await runFlow('GET_DEPOP_ITEM', { slug, platform: 'depop' });

        const item = result?.result?.state?.depopItemRaw;

        if (!result?.ok || !item) {
            return { ok: false, message: result?.result?.message || 'Error al obtener el item de Depop' };
        }

        return {
            ok: true,
            item: {
                title: item.description ?? '',
                description: item.description ?? '',
                price: item.pricing?.original_price?.total_price != null
                    ? Number(item.pricing.original_price.total_price)
                    : null,
            },
        };

    } catch (err: any) {
        return { ok: false, message: err?.message || 'Error inesperado' };
    }
}

export async function updateDepopItem(
    slug: string,
    publicationId: string,
    fields: { title: string; description: string; price: number }
) {
    try {
        const result = await runFlow('UPDATE_DEPOP_ITEM', {
            slug,
            platform: 'depop',
            fields: { description: fields.description, price: fields.price },
        });

        if (!result?.ok || !result.result?.state?.depopUpdateDone) {
            const errorMsg = result?.result?.message || 'Error al actualizar en Depop';
            return { ok: false, message: errorMsg };
        }

        const patchRes = await fetch(`/api/publications?id=${publicationId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ price: fields.price }),
        });

        if (!patchRes.ok) {
            const errorData = await patchRes.json().catch((): null => null);
            return {
                ok: false,
                message: errorData?.message || 'Publicación actualizada en Depop, pero no se pudo sincronizar el precio en la base de datos',
            };
        }

        return { ok: true, message: 'Publicación actualizada correctamente en Depop' };

    } catch (err: any) {
        return { ok: false, message: err?.message || 'Error inesperado' };
    }
}