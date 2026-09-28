import { validateListingRequiredFields, MissingFieldsError } from './validators'
import { runFlow, extractErrorMessage } from './extensionBridge'
import { uploadPhoto } from '@/utils/uploadPhoto'
import { transformListingImages } from '../images/processListingImages'
import type { Listing } from '@/app/inventory/listings/types'
import type { UploadResult } from '@/lib/external-integrations/validators'
import { sleep } from '../utils'
import type { Chat } from '@/app/chats/types'
import type { ChatMessage } from '@/app/chats/types'


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

        return { ok: false, message: extractErrorMessage(result, "No se pudo completar la publicación en Depop") };

    } catch (err: any) {
        return {
            ok: false,
            message: err?.message || "Error inesperado",
            missingFields: err instanceof MissingFieldsError ? err.fields : undefined,
        };
    }

}

export async function reuploadDepopItem(
    accountId: string, listing: Listing, itemExternalId: string, publicationId: string
): Promise<UploadResult> {

    try {

        const missing = validateListingRequiredFields(listing, 'depop')
        if (missing.length > 0) throw new MissingFieldsError(missing)

        // Borrar la publicacion
        const resDelete = await deleteDepopItem(itemExternalId, publicationId);

        if (!resDelete.ok) {
            return {
                ok: false,
                message: `No se pudo eliminar la publicación anterior: ${resDelete.message}`,
            };
        }

        console.log("Borrado")
        console.log(resDelete)

        // Modificar las imagenes
        const transformedImages = await transformListingImages(listing)

        const uploadedUrls = await Promise.all(
            transformedImages.map((blob, i) =>
                uploadPhoto(new File([blob], `${listing.id}_${i}.jpg`, { type: "image/jpeg" }))
            )
        );

        console.log("Imagenes")
        console.log(uploadedUrls)

        // Modificar el titulo y la descripcion
        const resModTexts = await fetch("/api/modify-texts", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                title: listing.title,
                description: listing.description,
            }),
        });

        if (!resModTexts.ok) {
            throw new Error("Error modificando título y descripción");
        }

        const { title: newTitle, description: newDescription } = await resModTexts.json();

        console.log("Textos")
        console.log(newTitle)

        // Crear un producto temporal con los campos del producto
        const modifiedListing: Listing = {
            ...listing,
            photo_url: uploadedUrls,
            title: newTitle,
            description: newDescription,
        };

        await sleep(60_000);

        // Resubir el producto y crear la nueva publicacion
        const uploadResult = await uploadDepopItem(
            modifiedListing,
            accountId
        );

        if (!uploadResult.ok) {
            return {
                ok: false,
                message: extractErrorMessage(uploadResult, `Error al resubir el producto: ${uploadResult.message}`),
            };
        }

        return {
            ok: true,
            message: "Publicación resubida correctamente en Depop",
            data: {
                listingId: listing.id,
                newTitle,
                newDescription,
                publication: uploadResult.data,
            },
        };

    } catch (err: any) {
        if (err instanceof MissingFieldsError) {
            return { ok: false, message: err.message, missingFields: err.fields }
        }
        return {
            ok: false,
            message: err?.message || 'Error inesperado',
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

        const res = await fetch(`/api/accounts/${userId}`);
        const account = await res.json();
        const externalId = (account.external_id ?? account.externalId)?.toString();

        const result = await runFlow('IMPORT_DEPOP_WARDROBE', { externalId });

        if (result?.result?.state?.items) {

            const items = result.result.state.items;

            const slimItems = items.map((item: any) => ({
                id: item.id,
                slug: item.slug,
                description: item.description,
                sold: item.sold,
                status: item.status,
                sizes: item.sizes,
                pricing: item.pricing?.original_price?.total_price != null
                    ? { original_price: { total_price: item.pricing.original_price.total_price } }
                    : item.pricing,
                pictures: (item.pictures ?? []).map((pic: any) => ({
                    '1280': pic?.['1280'],
                    '960': pic?.['960'],
                    '640': pic?.['640'],
                })),
            }));

            const BATCH_SIZE = 25;
            let lastData: any = null;

            for (let i = 0; i < slimItems.length; i += BATCH_SIZE) {
                const batch = slimItems.slice(i, i + BATCH_SIZE);

                const resApi = await fetch('/api/listings/import/depop', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        accountId: userId,
                        wardrobe: batch,
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

                lastData = data;
            }

            return {
                ok: true,
                message: lastData?.message ?? "Armario importado correctamente",
                data: lastData,
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

export async function fetchDepopChats(ownUserId?: string | number): Promise<{
    ok: boolean
    message: string
    chats?: Chat[]
    notices?: { id: string; text: string; updatedAt: string }[]
}> {
    try {
        const result = await runFlow('FETCH_DEPOP_CHATS', { platform: 'depop' })
        const state = result?.result?.state
        if (!state?.depopInbox && !state?.depopOffers) {
            return { ok: false, message: extractErrorMessage(result, 'No se pudieron obtener los chats de Depop') }
        }
        const { chats: inboxChats, notices } = mapDepopInbox(state.depopInbox ?? [], ownUserId)
        const offerChats = mapDepopOffers(state.depopOffers ?? [])
        const chats = [...inboxChats, ...offerChats]
        return {
            ok: true,
            message: chats.length ? `Se cargaron ${chats.length} conversaciones de Depop` : 'No hay conversaciones en Depop',
            chats,
            notices,
        }
    } catch (err: any) {
        return { ok: false, message: extractErrorMessage(err, 'Error inesperado al sincronizar chats de Depop') }
    }
}

export async function fetchDepopChatMessages(
    conversationId: string,
    ownUserId?: string | number
): Promise<{
    ok: boolean
    message: string
    messages?: ChatMessage[]
}> {
    try {
        const result = await runFlow('FETCH_DEPOP_CHAT_MESSAGES', { platform: 'depop', conversationId })
        const state = result?.result?.state
        const raw = state?.depopChatRaw
        if (!raw) {
            return { ok: false, message: extractErrorMessage(result, 'No se pudieron cargar los mensajes') }
        }
        return { ok: true, message: 'Mensajes cargados', messages: mapDepopMessages(raw, ownUserId) }
    } catch (err: any) {
        return { ok: false, message: extractErrorMessage(err, 'Error inesperado al cargar el chat') }
    }
}

export async function sendDepopChatMessage(
    conversationId: string,
    recipientUserId: string | number,
    text: string
): Promise<{
    ok: boolean
    message: string
    sent?: ChatMessage
}> {
    try {
        const result = await runFlow('SEND_DEPOP_CHAT_MESSAGE', {
            platform: 'depop',
            conversationId,
            recipientUserId,
            text,
        })
        const state = result?.result?.state
        const raw = state?.depopChatSendResult
        if (!raw && !result?.result?.done) {
            return { ok: false, message: extractErrorMessage(result, 'No se pudo enviar el mensaje') }
        }
        const sent: ChatMessage = {
            id: `local-${Date.now()}`,
            senderId: 'me',
            senderName: 'Tú',
            content: text,
            createdAt: new Date().toISOString(),
            isOwn: true,
        }
        return { ok: true, message: 'Mensaje enviado', sent }
    } catch (err: any) {
        return { ok: false, message: extractErrorMessage(err, 'Error inesperado al enviar el mensaje') }
    }
}

const pickDepopContactName = (u: any) =>
    (u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : '') || u?.username || 'Usuario de Depop'

export function mapDepopInbox(
    objects: any[],
    ownUserId?: string | number
): {
    chats: Chat[]
    notices: { id: string; text: string; updatedAt: string }[]
} {
    const chats: Chat[] = []
    const notices: { id: string; text: string; updatedAt: string }[] = []

    for (const c of objects ?? []) {
        const otherUser = c.users?.[0]
        const resolvedOwnUserId = ownUserId ?? c.user_id

        if (c.chat_meta_status === 'DEPOP_OFFICIAL' || c.read_only) {
            notices.push({
                id: c.conversation_id,
                text: c.last_message_text ?? '',
                updatedAt: new Date(c.last_message_timestamp * 1000).toISOString(),
            })
            continue
        }

        chats.push({
            id: `depop-${c.conversation_id}`,
            platform: 'depop',
            contactName: pickDepopContactName(otherUser),
            contactAvatarUrl: otherUser?.picture_url,
            listingImageUrl: undefined,
            lastMessagePreview: c.last_message_text ?? '',
            lastMessageAt: new Date(c.last_message_timestamp * 1000).toISOString(),
            unreadCount: c.unread_count ?? 0,
            messages: [],
            messagesLoaded: false,
            channelId: c.conversation_id,
            externalUrl: `https://www.depop.com/messages/${c.conversation_id}/`,
            recipientUserId: otherUser?.id,
            ownUserId: resolvedOwnUserId,
        } as any)
    }
    return { chats, notices }
}

export function mapDepopMessages(raw: { objects: any[] }, ownUserId?: string | number): ChatMessage[] {
    return (raw?.objects ?? [])
        .map((m: any) => {
            const isOwn = ownUserId != null && String(m.user_id) === String(ownUserId)
            return {
                id: String(m.id),
                senderId: String(m.user_id),
                senderName: isOwn ? 'Tú' : '',
                content: m.text ?? '',
                createdAt: new Date(m.created_timestamp * 1000).toISOString(),
                isOwn,
            } as ChatMessage
        })
        .sort((a: ChatMessage, b: ChatMessage) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
}

const pickOfferContactName = (o: any) =>
    `${o.offerer_first_name ?? ''} ${o.offerer_last_name ?? ''}`.trim() || o.offerer_username || 'Comprador de Depop'

// Las ofertas de Depop no son conversaciones reales (no hay endpoint de
// mensajes para ellas, solo aceptar/rechazar/contraofertar, que no está
// cubierto aquí), así que cada oferta se representa como un "chat" con un
// único mensaje ya resuelto en el propio mapeo — messagesLoaded: true evita
// que la UI intente cargar mensajes o hacer polling sobre ella.
export function mapDepopOffers(offers: any[]): Chat[] {
    return (offers ?? []).map((o: any) => {
        const priceNote = o.originalPrice ? ` (precio del artículo: ${o.originalPrice} ${o.currency ?? o.offer_currency})` : ''
        const content = `Te ofrece ${o.offer_value} ${o.offer_currency} por tu artículo${priceNote}`
        // La respuesta no trae fecha de creación de la oferta, solo expires_at,
        // así que usamos "ahora" para que aparezca junto a lo más reciente.
        const createdAt = new Date().toISOString()

        return {
            id: `depop-offer-${o.offer_id}`,
            platform: 'depop',
            contactName: pickOfferContactName(o),
            contactAvatarUrl: undefined,
            listingImageUrl: o.pictureUrl,
            listingTitle: o.productDescription ? String(o.productDescription).slice(0, 60) : undefined,
            lastMessagePreview: content,
            lastMessageAt: createdAt,
            unreadCount: o.offer_display_status === 'RECEIVED' ? 1 : 0,
            messages: [{
                id: `depop-offer-msg-${o.offer_id}`,
                senderId: String(o.offerer_id),
                senderName: pickOfferContactName(o),
                content,
                createdAt,
                isOwn: false,
            }],
            messagesLoaded: true,
            channelId: undefined,
            externalUrl: undefined,
            // Flags para que page.tsx no intente cargar mensajes ni permitir
            // respuesta de texto sobre esto (ver nota en page.tsx).
            isOffer: true,
            recipientUserId: o.offerer_id,
        } as any
    })
}