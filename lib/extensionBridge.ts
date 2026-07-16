/*
  Interfaz de funciones para Vinted y Wallapop que hacen uso de la extension.
  Tiene cada una de las funcionalidades. TODO: Subir producto a Wallapop.
*/


"use client"

import { validateListingRequiredFields, MissingFieldsError } from './validators'
import type { UploadResult } from '@/lib/validators'

const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID!
declare const chrome: any

async function getToken(): Promise<string | null> {
  const res = await fetch("/api/extension/token")
  if (!res.ok) return null
  const data = await res.json()
  return data.token ?? null
}

async function syncTokenWithExtension() {
  if (typeof chrome === "undefined" || !chrome.runtime) return
  const token = await getToken()
  if (!token) return
  try {
    chrome.runtime.sendMessage(EXTENSION_ID, { type: "SET_TOKEN", token })
  } catch {
    // Extension may not be installed
  }
}

async function runFlow(flow: string, payload: any = {}): Promise<any> {
  if (typeof chrome === "undefined" || !chrome.runtime) return

  await syncTokenWithExtension()

  return new Promise<any>((resolve, reject) => {
    try {
      // Mandamos el workflow al background de la extension, la cual ira pidiendo los steps a la api
      chrome.runtime.sendMessage(
        EXTENSION_ID,
        { type: "RUN_FLOW", flow, payload },
        (response: any) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
            return
          }
          resolve(response)
        }
      )
    } catch (e) {
      console.log(e)
      reject(e)
    }
  })
}


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

// Subir producto a Vestiaire Collective
export async function uploadVestiaireItem(listing: any, accountId: string): Promise<UploadResult> {
  try {

    if (isRejectedByVestiaire(listing.attributes?.brand)) {
      throw new Error(`La marca "${listing.attributes.brand}" no está aceptada en Vestiaire Collective`)
    }

    const missing = validateListingRequiredFields(listing)
    if (missing.length > 0) throw new MissingFieldsError(missing)

    const result = await runFlow('UPLOAD_VESTIAIRE_ITEM', { listing })

    const vestProductId = result?.result?.state?.vestProductId
    const vestPublicationUrl = result?.result?.state?.vestPublicationUrl

    if (vestProductId) {
      const res = await fetch('/api/publications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId: vestProductId,
          listingId: listing.id,
          platform: 'vestiaire',
          publicationUrl: vestPublicationUrl,
          accountId,
        })
      })

      const data = await res.json()

      if (!res.ok || data.status !== 'success') {
        return { ok: false, message: data.message || 'Error guardando la publicación' }
      }

      return { ok: true, message: data.message, data }
    }

    return { ok: false, message: 'No se recibió ID del item creado' }

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

// Buscar cuenta de Vestiaire Collective
export async function searchVestiaireAccount() {
  try {
    const result = await runFlow("SEARCH_VESTIAIRE_ACCOUNT");

    if (!result?.result?.state) {
      return {
        ok: false,
        message: "No se pudo obtener la cuenta desde la extensión",
      };
    }

    const { userId, profileLink, vestiaireId } = result.result.state;
    const { accountName } = result.result.result;

    const res = await fetch("/api/accounts/vestiaire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ externalId: userId, profileLink, accountName, vestiaireId }),
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

// Sincronizar cuenta de Vestiaire
export async function syncVestiaireAccount(externalId: string, vestiaireId: string | null) {
  try {

    const result = await runFlow('SYNC_VESTIAIRE_ACCOUNT', { vestiaireId });
    if (!result?.result?.state) {
      await fetch('/api/accounts/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ externalId, syncStatus: 'ACCOUNT_NOT_FOUND', platform: 'vestiaire' })
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
        platform: 'vestiaire'
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
      body: JSON.stringify({ externalId, syncStatus: 'ACCOUNT_NOT_FOUND', platform: 'vestiaire' })
    });
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


export async function deleteVestiaireItem(itemExternalId: string, publicationId: string) {
  try {
    const result = await runFlow('DELETE_VESTIAIRE_ITEM', { itemExternalId });

    if (!result || !result.ok || !result.result?.done) {
      const errorMsg = result?.result?.result?.message || result?.result?.message || 'Error al eliminar en Vestiaire';
      return { ok: false, message: errorMsg };
    }

    if (result.result.result && result.result.result.code !== undefined && result.result.result.code !== 0) {
      const errorMsg = result.result.result.message || 'Error al eliminar en Vestiaire';
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
      message: 'Publicación eliminada correctamente de Vestiaire y de la BD',
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

// Actualizar precio de un producto en Vestiaire Collective 
// Actualizar precio de un producto en Vestiaire Collective 
export async function updateVestiaireItem(
  userExternalId: string,
  itemExternalId: string,
  publicationId: string,
  fields: { title: string; description: string; price: number }
) {
  try {
    const result = await runFlow('UPDATE_VESTIAIRE_ITEM', { userExternalId, itemExternalId, fields });

    if (!result || !result.ok || !result.result?.done) {
      const errorMsg = result?.result?.result?.message || result?.result?.message || 'Error al actualizar en Vestiaire';
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
        message: errorData?.message || 'Publicación actualizada en Vestiaire, pero no se pudo sincronizar el precio en la base de datos',
      };
    }

    return {
      ok: true,
      message: 'Publicación actualizada correctamente en Vestiaire',
    };

  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Error inesperado',
    };
  }
}

const REJECTED_BRANDS = new Set([
  "abercrombie & fitch", "american apparel", "asos", "atmosphère", "atmosphere",
  "benetton", "bershka", "boohoo", "burton", "calzedonia",
  "christopher kane for topshop", "cider", "coast", "debenhams", "desigual",
  "disney", "dorothy perkins", "fashion nova", "forever 21", "gap",
  "h&m", "hm", "hollister", "intimissimi", "jennyfer", "karen millen",
  "kate moss for topshop", "mango", "marques'almeida for topshop",
  "mary katrantzou for topshop", "miss selfridge", "missguided", "misspap",
  "monki", "na-kd", "nakd", "nasty gal", "new look", "oasis", "old navy",
  "only", "ovs", "oysho", "piazza italia", "prettylittlething", "primark",
  "pull & bear", "pull&bear", "reserved", "shein", "stradivarius",
  "tally weijl", "tezenis", "tom tailor", "topman", "topshop",
  "topshop unique", "topshop boutique", "topshop x j.w. anderson",
  "u.s. polo assn.", "us polo assn", "uniqlo", "urban outfitters",
  "vero moda", "wallis", "warehouse", "weekday", "zara",
  // Essentials
  "fear of god essentials", "fog essentials", "essentials",
])

function normalizeBrand(brand: string): string {
  return brand
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9& ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isRejectedByVestiaire(brand: string | null | undefined): boolean {
  if (!brand) return false
  const normalized = normalizeBrand(brand)

  // Exacto
  if (REJECTED_BRANDS.has(normalized)) return true

  // Parcial
  for (const rejected of REJECTED_BRANDS) {
    if (normalized.startsWith(rejected) || normalized === rejected) return true
  }

  return false
}