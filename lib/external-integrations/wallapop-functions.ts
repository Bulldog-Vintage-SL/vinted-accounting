import { validateListingRequiredFields, MissingFieldsError } from './validators'
import { runFlow } from './extensionBridge'
import type { UploadResult } from '@/lib/external-integrations/validators'

// Subir producto a Wallapop
export async function uploadWallapopItem(listing: any, accountId: string): Promise<UploadResult> {
  try {

    const missing = validateListingRequiredFields(listing)
    if (missing.length > 0) throw new MissingFieldsError(missing)

    const result = await runFlow('UPLOAD_WALLAPOP_ITEM', { listing })
    const item = result?.result?.result

    if (item?.id) {
      const itemId = item.id
      const publicationUrl = item.share_url || `https://wallapop.com/item/${item.slug}`

      const res = await fetch('/api/publications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId: itemId,
          listingId: listing.id,
          platform: 'wallapop',
          publicationUrl,
          title: item.title?.original,
          price: item.price?.cash?.amount,
          images: item.images?.map((img: any) => img.urls?.big || img.urls?.medium),
          accountId: accountId
        })
      })

      const data = await res.json()

      if (!res.ok || data.status !== "success") {
        return {
          ok: false,
          message: data.message || "Error guardando la publicacion",
        }
      }

      return {
        ok: true,
        message: data.message,
        data,
      }
    }

    return { ok: false, message: "No se recibió ID del item creado" }

  } catch (err: any) {
    if (err instanceof MissingFieldsError) {
      return { ok: false, message: err.message, missingFields: err.fields }
    }
    return {
      ok: false,
      message: err?.message || "Error inesperado",
    }
  }
}

// Buscar cuenta de Wallapop
export async function searchWallapopAccount() {
  try {
    const result = await runFlow("SEARCH_WALLAPOP_ACCOUNT", { platform: 'wallapop' });
    console.log("result completo:", JSON.stringify(result))

    if (!result?.result?.state) {
      return {
        ok: false,
        message: "No se pudo obtener la cuenta desde la extensión",
      };
    }

    const { userId, profileLink, accountName, email, userType, subscriptions } = result.result.state

    const res = await fetch("/api/accounts/wallapop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        externalId: userId,
        profileLink,
        accountName
      }),
    })
    const data = await res.json()

    console.log("respuesta wallapop route:", res.ok, data)

    if (!res.ok || data.status !== "success") {
      return {
        ok: false,
        message: data.message || "Error guardando la cuenta",
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
      message: err?.message || "Error inesperado",
    }
  }
}


// Sincronizar cuenta de Wallapop
export async function syncWallapopAccount(externalId: string) {
  try {
    const result = await runFlow('SYNC_WALLAPOP_ACCOUNT', { externalId })

    if (!result?.result?.state) {

      // Si falla la peticion marcamos como sesion expirada
      await fetch('/api/accounts/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ externalId, syncStatus: 'ACCOUNT_NOT_FOUND', platform: 'wallapop' })
      })

      return {
        ok: false,
        message: "No se pudo obtener la cuenta desde la extensión",
      }
    }

    const { userId } = result.result.state
    console.log(userId);

    const syncStatus = userId === externalId ? 'OK' : 'ACCOUNT_NOT_FOUND'

    const res = await fetch('/api/accounts/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        externalId,
        syncStatus,
        platform: 'wallapop'
      })
    })

    const data = await res.json()

    if (!res.ok || data.status !== "success") {
      return {
        ok: false,
        message: data.message || "Error guardando la cuenta",
      }
    }

    return { ok: true, message: data.message, data }

  } catch (err: any) {

    // Si falla la peticion marcamos como sesion expirada
    await fetch('/api/accounts/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ externalId, syncStatus: 'ACCOUNT_NOT_FOUND', platform: 'wallapop' })
    })

    return {
      ok: false,
      message: err?.message || "Error inesperado",
    }
  }
}


// Importar productos de Wallapop
export async function importWallapopWardrobe(userId: string) {

  try {

    // Iniciamos el workflow en la extension con el nombre pertinente
    const result = await runFlow('IMPORT_WALLAPOP_WARDROBE');

    if (result?.result?.state?.items) {

      const items = result.result.state.items;

      // Importamos los articulos que se nos han devuelto
      const resApi = await fetch('/api/listings/import/wallapop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wardrobe: items,
          timestamp: Date.now(),
          accountId: userId
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


export async function deleteWallapopItem(itemExternalId: string, publicationId: string) {
  try {
    const result = await runFlow('DELETE_WALLAPOP_ITEM', { itemExternalId });

    if (!result || !result.ok || !result.result?.done) {
      const errorMsg = result?.result?.result?.message || result?.result?.message || 'Error al eliminar en Wallapop';
      return { ok: false, message: errorMsg };
    }

    if (result.result.result && result.result.result.code !== undefined && result.result.result.code !== 0) {
      const errorMsg = result.result.result.message || 'Error al eliminar en Wallapop';
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
      message: 'Publicación eliminada correctamente de Wallapop y de la BD',
    };

  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Error inesperado',
    };
  }
}


// Obtener datos actuales (titulo, descripcion, precio) de un item de Wallapop
export async function getWallapopItem(itemExternalId: string) {
  try {
    const result = await runFlow('GET_WALLAPOP_ITEM', { itemExternalId });

    if (!result || !result.ok || !result.result?.done) {
      const errorMsg = result?.result?.result?.message || result?.result?.message || 'Error al obtener el item de Wallapop';
      return { ok: false, message: errorMsg };
    }

    const item = result.result.result;

    if (!item) {
      return { ok: false, message: 'No se recibieron datos del item' };
    }

    return {
      ok: true,
      item: {
        title: item.title?.original ?? '',
        description: item.description?.original ?? '',
        price: item.price?.cash?.amount != null ? Number(item.price.cash.amount) : null,
      },
    };

  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Error inesperado',
    };
  }
}


// Obtener datos actuales (titulo, descripcion, precio) de un item de Vestiaire Collective
export async function getVestiaireItem(itemExternalId: string) {
  try {
    const result = await runFlow('GET_VESTIAIRE_ITEM', { itemExternalId });

    if (!result || !result.ok || !result.result?.done) {
      const errorMsg = result?.result?.result?.message || result?.result?.message || 'Error al obtener el item de Vestiaire';
      return { ok: false, message: errorMsg };
    }

    const item = result.result.result;

    if (!item) {
      return { ok: false, message: 'No se recibieron datos del item' };
    }

    return {
      ok: true,
      item: {
        title: item.title?.original ?? '',
        description: item.description?.original ?? '',
        price: item.price?.cash?.amount != null ? Number(item.price.cash.amount) : null,
      },
    };

  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Error inesperado',
    };
  }
}




// Actualizar campos de un item de Wallapop
export async function updateWallapopItem(
  itemExternalId: string,
  publicationId: string,
  fields: { title: string; description: string; price: number }
) {
  try {
    const result = await runFlow('UPDATE_WALLAPOP_ITEM', { itemExternalId, fields });

    if (!result || !result.ok || !result.result?.done) {
      const errorMsg = result?.result?.result?.message || result?.result?.message || 'Error al actualizar en Wallapop';
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
        message: errorData?.message || 'Publicación actualizada en Wallapop, pero no se pudo sincronizar el precio en la base de datos',
      };
    }

    return {
      ok: true,
      message: 'Publicación actualizada correctamente en Wallapop',
    };

  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Error inesperado',
    };
  }
}