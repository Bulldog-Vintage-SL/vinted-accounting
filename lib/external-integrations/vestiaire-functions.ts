import { validateListingRequiredFields, MissingFieldsError } from './validators'
import { runFlow } from './extensionBridge'
import type { UploadResult } from '@/lib/external-integrations/validators'

// Subir producto a Vestiaire Collective
export async function uploadVestiaireItem(listing: any, accountId: string): Promise<UploadResult> {
  try {

    if (isRejectedByVestiaire(listing.attributes?.brand)) {
      throw new Error(`La marca "${listing.attributes.brand}" no está aceptada en Vestiaire Collective`)
    }

    const missing = validateListingRequiredFields(listing, 'vestiaire')
    if (missing.length > 0) throw new MissingFieldsError(missing)

    const result = await runFlow('UPLOAD_VESTIAIRE_ITEM', { listing, platform: 'vestiaire' })

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


// Buscar cuenta de Vestiaire Collective
export async function searchVestiaireAccount() {
  try {
    const result = await runFlow("SEARCH_VESTIAIRE_ACCOUNT", {platform: 'vestiaire'});

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


// Sincronizar cuenta de Vestiaire
export async function syncVestiaireAccount(externalId: string, vestiaireId: string | null) {
  try {

    const result = await runFlow('SYNC_VESTIAIRE_ACCOUNT', { vestiaireId, platform: 'vestiaire' });
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


export async function deleteVestiaireItem(itemExternalId: string, publicationId: string) {
  try {
    const result = await runFlow('DELETE_VESTIAIRE_ITEM', { itemExternalId, platform: 'vestiaire' });

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


// Obtener datos actuales (titulo, descripcion, precio) de un item de Vestiaire Collective
export async function getVestiaireItem(itemExternalId: string) {
  try {
    const result = await runFlow('GET_VESTIAIRE_ITEM', { itemExternalId, platform: 'vestiaire' });

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