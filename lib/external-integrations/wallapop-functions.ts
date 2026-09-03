import { validateListingRequiredFields, MissingFieldsError } from './validators'
import { runFlow } from './extensionBridge'
import { uploadPhoto } from '@/utils/uploadPhoto'
import { transformListingImages } from '../images/processListingImages'
import type { Listing } from '@/app/inventory/listings/types'
import type { UploadResult } from '@/lib/external-integrations/validators'
import { sleep } from '../utils'

// Subir producto a Wallapop
export async function uploadWallapopItem(listing: any, accountId: string): Promise<UploadResult> {
  try {

    const missing = validateListingRequiredFields(listing, 'wallapop')
    if (missing.length > 0) throw new MissingFieldsError(missing)

    const result = await runFlow('UPLOAD_WALLAPOP_ITEM', { listing, platform: 'wallapop' })
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

export async function reuploadWallapopItem(
  accountId: string, listing: Listing, itemExternalId: string, publicationId: string
): Promise<UploadResult> {

  try {

    const missing = validateListingRequiredFields(listing, 'wallapop')
    if (missing.length > 0) throw new MissingFieldsError(missing)

    // Borrar la publicacion
    const resDelete = await deleteWallapopItem(itemExternalId, publicationId);

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
    const uploadResult = await uploadWallapopItem(
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
      message: "Publicación resubida correctamente en Wallapop",
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
    const result = await runFlow('SYNC_WALLAPOP_ACCOUNT', { externalId, platform: 'wallapop'
     })

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
    const result = await runFlow('IMPORT_WALLAPOP_WARDROBE', {platform: 'wallapop'});

    if (result?.result?.state?.items) {

      const items = result.result.state.items;

      // Nos quedamos solo con los campos que usa el endpoint de import:
      // el JSON completo de Wallapop (imágenes en varios tamaños, etc.)
      // supera el límite de 4.5MB de body de Vercel (413) con armarios grandes.
      const slimItems = items.map((item: any) => ({
        id: item.id,
        title: item.title,
        slug: item.slug,
        price: { amount: item.price?.amount },
        images: (item.images ?? []).map((image: any) => ({
          urls: {
            big: image?.urls?.big,
            medium: image?.urls?.medium,
            small: image?.urls?.small,
          },
        })),
      }));

      const BATCH_SIZE = 25;
      let lastData: any = null;

      for (let i = 0; i < slimItems.length; i += BATCH_SIZE) {
        const batch = slimItems.slice(i, i + BATCH_SIZE);

        const resApi = await fetch('/api/listings/import/wallapop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wardrobe: batch,
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


export async function deleteWallapopItem(itemExternalId: string, publicationId: string) {
  try {
    const result = await runFlow('DELETE_WALLAPOP_ITEM', { itemExternalId, platform: 'wallapop' });

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
    const result = await runFlow('GET_WALLAPOP_ITEM', { itemExternalId, platform: 'wallapop' });

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


// Actualizar campos de un item de Wallapop
export async function updateWallapopItem(
  itemExternalId: string,
  publicationId: string,
  fields: { title: string; description: string; price: number }
) {
  try {
    const result = await runFlow('UPDATE_WALLAPOP_ITEM', { itemExternalId, fields, platform: 'wallapop' });

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

