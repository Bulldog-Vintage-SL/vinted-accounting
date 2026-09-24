import { validateListingRequiredFields, MissingFieldsError } from './validators'
import { runFlow, extractErrorMessage } from './extensionBridge'
import { uploadPhoto } from '@/utils/uploadPhoto'
import { transformListingImages } from '../images/processListingImages'
import type { Listing } from '@/app/inventory/listings/types'
import type { UploadResult } from '@/lib/external-integrations/validators'
import type { Chat } from '@/app/chats/types'
import type { ChatMessage } from '@/app/chats/types'
import { sleep } from '../utils'

// Subir producto a Vinted
export async function uploadItem(listing: any, accountId: string): Promise<UploadResult> {

  try {

    const missing = validateListingRequiredFields(listing, 'vinted')
    if (missing.length > 0) throw new MissingFieldsError(missing)

    const result = await runFlow('UPLOAD_ITEM', { listing })

    if (result?.result?.result?.item?.id) {
      const itemId = result.result.result.item.id
      const publicationUrl = `https://www.vinted.es/items/${itemId}`

      // Si hemos tenido exito creamos la publicacion asociada
      const res = await fetch('/api/publications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId: itemId,
          listingId: listing.id,
          platform: 'vinted',
          publicationUrl,
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

    return { ok: false, message: extractErrorMessage(result, "No se recibió ID del item creado") }

  } catch (err: any) {
    if (err instanceof MissingFieldsError) {
      return { ok: false, message: err.message, missingFields: err.fields }
    }
    return {
      ok: false,
      message: extractErrorMessage(err, "Error inesperado"),
    }
  }

}

export async function reuploadVintedItem(
  accountId: string, listing: Listing, itemExternalId: string, publicationId: string
): Promise<UploadResult> {

  try {

    const missing = validateListingRequiredFields(listing, 'vinted')
    if (missing.length > 0) throw new MissingFieldsError(missing)

    // Borrar la publicacion
    const resDelete = await deleteVintedItem(itemExternalId, publicationId);

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
      const errorData = await resModTexts.json().catch((): null => null);
      throw new Error(extractErrorMessage(errorData, "Error modificando título y descripción"));
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
    const uploadResult = await uploadItem(
      modifiedListing,
      accountId
    );

    if (!uploadResult.ok) {
      return {
        ok: false,
        message: `Error al resubir el producto: ${uploadResult.message}`,
      };
    }

    return {
      ok: true,
      message: "Publicación resubida correctamente en Vinted",
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
      message: extractErrorMessage(err, "Error inesperado"),
    };
  }

}

// Buscar cuenta de Vinted
export async function searchVintedAccount() {
  try {
    const result = await runFlow("SEARCH_ACCOUNT");

    if (!result?.result?.state) {
      return {
        ok: false,
        message: "No se pudo obtener la cuenta desde la extensión",
      };
    }

    const { userId, profileLink } = result.result.state;
    const { accountName } = result.result.result;

    const res = await fetch("/api/accounts/vinted", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ externalId: userId, profileLink, accountName }),
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

// Sincronizar cuenta de Vinted
export async function syncVintedAccount(externalId: string) {

  if (!externalId) {
    return {
      ok: false,
      message: "ID de cuenta no válido",
    };
  }

  try {

    const result = await runFlow('SYNC_ACCOUNT', { externalId })

    if (result?.result?.state) {
      const syncStatus = result.result.state.syncStatus ?? 'ACCOUNT_NOT_FOUND'

      const res = await fetch('/api/accounts/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId,
          syncStatus,
          platform: 'vinted'
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

  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || "Error inesperado",
    };
  }

}

// Importar productos de Vinted
export async function importWardrobe(userId: string) {

  try {

    // Primero obtenemos el id de la cuenta de vinted correspondiente a userId
    const res = await fetch(`/api/accounts/${userId}`);
    const account = await res.json();
    const externalId = (account.external_id ?? account.externalId)?.toString();

    // Iniciamos el workflow en la extension con el id pertinente
    const result = await runFlow('IMPORT_WARDROBE', { externalId });

    if (result?.result?.state?.items) {

      const items = result.result.state.items;

      const slimItems = items.map((item: any) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        brand: item.brand,
        size: item.size,
        price: { amount: item.price?.amount },
        is_draft: item.is_draft,
        is_closed: item.is_closed,
        is_reserved: item.is_reserved,
        is_hidden: item.is_hidden,
        photos: (item.photos ?? []).map((p: any) => ({ url: p.url })),
      }));

      // Importamos por lotes: evita el límite de 4.5MB de body y mantiene
      // cada invocación del endpoint (que descarga y resube fotos) corta.
      const BATCH_SIZE = 25;
      let created = 0;
      let alreadyImported = 0;
      let blockedByOtherUser = 0;
      let lastData: any = null;

      for (let i = 0; i < slimItems.length; i += BATCH_SIZE) {
        const batch = slimItems.slice(i, i + BATCH_SIZE);

        const resApi = await fetch('/api/listings/import/vinted', {
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

        created += data.created ?? 0;
        alreadyImported += data.alreadyImported ?? 0;
        blockedByOtherUser += data.blockedByOtherUser ?? 0;
        lastData = data;
      }

      const parts = [`${created} importados`];
      if (alreadyImported > 0) parts.push(`${alreadyImported} ya existentes`);
      if (blockedByOtherUser > 0) parts.push(`${blockedByOtherUser} vinculados a otro usuario`);

      return {
        ok: true,
        message: `Armario procesado: ${parts.join(", ")}`,
        data: { ...lastData, created, alreadyImported, blockedByOtherUser },
      };

    }

  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || "Error inesperado",
    };
  }

}


export async function deleteVintedItem(itemExternalId: string, publicationId: string) {
  try {
    const result = await runFlow('DELETE_VINTED_ITEM', { itemExternalId });

    if (!result || !result.ok || !result.result?.done || result.result?.result?.code !== 0) {
      const errorMsg = result?.result?.result?.message || result?.result?.message || 'Error al eliminar en Vinted';
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
      message: 'Publicación eliminada correctamente de Vinted y de la BD',
    };

  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Error inesperado',
    };
  }
}


// Obtener datos actuales (titulo, descripcion, precio) de un item de Vinted
export async function getVintedItem(itemExternalId: string) {
  try {

    const result = await runFlow('GET_VINTED_ITEM', { itemExternalId });

    if (!result || !result.ok || !result.result?.done) {
      const errorMsg = result?.result?.result?.message || result?.result?.message || 'Error al obtener el item de Vinted';
      return { ok: false, message: errorMsg };
    }

    const item = result.result.result?.item;

    if (!item) {
      return { ok: false, message: 'No se recibieron datos del item' };
    }

    return {
      ok: true,
      item: {
        title: item.title ?? '',
        description: item.description ?? '',
        price: item.price?.amount != null ? Number(item.price.amount) : null,
      },
    };

  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Error inesperado',
    };
  }
}

// Actualizar campos de un item de Vinted
export async function updateVintedItem(
  itemExternalId: string,
  publicationId: string,
  fields: { title: string; description: string; price: number }
) {
  try {
    const result = await runFlow('UPDATE_VINTED_ITEM', { itemExternalId, fields });

    if (!result || !result.ok || !result.result?.done || result.result?.result?.code !== 0) {
      const errorMsg = result?.result?.result?.message || result?.result?.message || 'Error al actualizar en Vinted';
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
        message: errorData?.message || 'Publicación actualizada en Vinted, pero no se pudo sincronizar el precio en la base de datos',
      };
    }

    return {
      ok: true,
      message: 'Publicación actualizada correctamente en Vinted',
    };

  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Error inesperado',
    };
  }
}

export async function fetchVintedChats(): Promise<{
  ok: boolean
  message: string
  chats?: Chat[]
  notices?: { id: string; text: string; updatedAt: string }[]
}> {
  try {
    const result = await runFlow('FETCH_VINTED_CHATS', { platform: 'vinted' })
    const state = result?.result?.state
    if (!state?.vintedInbox) {
      return { ok: false, message: extractErrorMessage(result, 'No se pudieron obtener los chats de Vinted') }
    }
    const { chats, notices } = mapVintedInbox(state.vintedInbox)
    return {
      ok: true,
      message: chats.length ? `Se cargaron ${chats.length} conversaciones de Vinted` : 'No hay conversaciones en Vinted',
      chats,
      notices,
    }
  } catch (err: any) {
    return { ok: false, message: extractErrorMessage(err, 'Error inesperado al sincronizar chats de Vinted') }
  }
}

export async function fetchVintedChatMessages(conversationId: string): Promise<{
  ok: boolean
  message: string
  messages?: ChatMessage[]
}> {
  try {
    const result = await runFlow('FETCH_VINTED_CHAT_MESSAGES', {
      platform: 'vinted',
      conversationId
    })
    const raw = result?.result?.state?.vintedChatRaw
    if (!raw) {
      return { ok: false, message: extractErrorMessage(result, 'No se pudieron cargar los mensajes') }
    }
    return { ok: true, message: 'Mensajes cargados', messages: mapVintedMessages(raw) }
  } catch (err: any) {
    return { ok: false, message: extractErrorMessage(err, 'Error inesperado al cargar el chat') }
  }
}

export async function sendVintedChatMessage(conversationId: string, text: string): Promise<{
  ok: boolean
  message: string
  sent?: ChatMessage
}> {
  try {
    const result = await runFlow('SEND_VINTED_CHAT_MESSAGE', {
      platform: 'vinted',
      conversationId,
      text
    })
    const state = result?.result?.state
    const raw = state?.vintedChatSendResult ?? result?.result?.result
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

const isSystemConv = (c: any) =>
  c.opposite_user?.badge === 'moderator' || c.opposite_user?.login === 'Vinted'

const pickThumb = (photo: any, type: string) =>
  photo?.thumbnails?.find((t: any) => t.type === type)?.url ?? photo?.url ?? undefined

export function mapVintedInbox(inbox: any[]): {
  chats: Chat[]
  notices: { id: string; text: string; updatedAt: string }[]
} {
  const chats: Chat[] = []
  const notices: { id: string; text: string; updatedAt: string }[] = []

  for (const c of inbox ?? []) {
    if (isSystemConv(c)) {
      notices.push({ id: String(c.id), text: c.description ?? '', updatedAt: c.updated_at })
      continue
    }

    chats.push({
      id: `vinted-${c.id}`,                
      platform: 'vinted',
      contactName: c.opposite_user?.login ?? 'Usuario de Vinted',
      contactAvatarUrl: pickThumb(c.opposite_user?.photo, 'thumb100'),
      listingImageUrl: pickThumb(c.item_photos?.[0], 'thumb150x210'),
      lastMessagePreview: c.description ?? '',
      lastMessageAt: new Date(c.updated_at).toISOString(),
      unreadCount: c.unread ? 1 : 0,
      messages: [],
      messagesLoaded: false,
      channelId: String(c.id),                 
      externalUrl: `https://www.vinted.es/inbox/${c.id}`,
    })
  }
  return { chats, notices }
}

const toIso = (v: any) => {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

export function mapVintedMessages(conv: any): ChatMessage[] {
  const otherId = String(conv?.opposite_user?.id ?? '')
  return (conv?.messages ?? [])
    .filter((m: any) => m.entity_type === 'message')
    .map((m: any) => {
      const e = m.entity ?? {}
      const senderId = String(e.user_id ?? '')
      const isOwn = senderId !== otherId
      return {
        id: String(e.id),
        senderId,
        senderName: isOwn ? 'Tú' : conv.opposite_user?.login ?? '',
        content: e.body ?? '',
        createdAt: toIso(m.created_at_ts ?? e.created_at_ts),
        isOwn,
      } as ChatMessage
    })
    .sort((a: ChatMessage, b: ChatMessage) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
}