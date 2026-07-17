import { validateListingRequiredFields, MissingFieldsError } from './validators'
import { runFlow } from './extensionBridge'
import type { UploadResult } from '@/lib/external-integrations/validators'

// Subir producto a Vinted
export async function uploadItem(listing: any, accountId: string): Promise<UploadResult> {

  try {

    const missing = validateListingRequiredFields(listing)
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

      // Importamos los articulos que se nos han devuelto
      const resApi = await fetch('/api/listings/import/vinted', {
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

export async function importVestiaireWardrobe(accountId: string) {
  try {

    // Primero obtenemos el id de la cuenta de vinted correspondiente a userId
    const resAcc = await fetch(`/api/accounts/${accountId}`);
    const account = await resAcc.json();
    const externalId = (account.external_id ?? account.externalId)?.toString();

    const result = await runFlow('IMPORT_VESTIAIRE_WARDROBE', { externalId })
    console.log(result)

    if (!result?.result?.result?.items) {
      return { ok: false, message: 'No se pudieron obtener los artículos' }
    }

    const items = result.result.result.items

    const res = await fetch('/api/listings/import/vestiaire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: accountId,
        wardrobe: items,
        timestamp: Date.now()
      })
    })

    const data = await res.json()
    if (!res.ok || data.status !== 'success') {
      return { ok: false, message: data.message || 'Error guardando artículos' }
    }

    return { ok: true, message: data.message, data }

  } catch (err: any) {
    return { ok: false, message: err?.message || 'Error inesperado' }
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


