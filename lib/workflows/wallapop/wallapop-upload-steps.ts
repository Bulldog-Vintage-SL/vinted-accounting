import type { WorkflowStep } from '../types'

export function buildWallapopSteps(listing: any): WorkflowStep[] {
  const steps: WorkflowStep[] = []

  // 1. Obtener datos del usuario (userId, location)
  steps.push({
    id: crypto.randomUUID(),
    platform: 'wallapop',
    type: 'GET_USER_ME',
    request: { url: 'https://api.wallapop.com/api/v3/users/me', method: 'GET' }
  })

  // 2. Resolver category_leaf_id y subcategoryIds desde el árbol
  steps.push({
    id: crypto.randomUUID(),
    platform: 'wallapop',
    type: 'GET_WALLA_CATEGORIES',
    request: { url: 'https://api.wallapop.com/api/v3/categories', method: 'GET' }
  })

  // 3. Primera llamada a components (inicializa el upload, devuelve opciones de talla/color/condition)
  steps.push({
    id: crypto.randomUUID(),
    platform: 'wallapop',
    type: 'GET_WALLA_COMPONENTS',
    request: {
      url: 'https://api.wallapop.com/api/v3/items/upload/components',
      method: 'POST',
      body: {} // relleno en processStepResult
    }
  })

  // 4. Primera llamada a weight tiers
  steps.push({
    id: crypto.randomUUID(),
    platform: 'wallapop',
    type: 'GET_WALLA_WEIGHT_TIERS',
    request: { url: 'DYNAMIC', method: 'GET' }
  })

  // 5. Segunda llamada a components (Wallapop lo hace de nuevo tras los weight tiers)
  steps.push({
    id: crypto.randomUUID(),
    platform: 'wallapop',
    type: 'GET_WALLA_COMPONENTS',
    request: {
      url: 'https://api.wallapop.com/api/v3/items/upload/components',
      method: 'POST',
      body: {}
    }
  })

  // 6. Segunda llamada a weight tiers
  steps.push({
    id: crypto.randomUUID(),
    platform: 'wallapop',
    type: 'GET_WALLA_WEIGHT_TIERS',
    request: { url: 'DYNAMIC', method: 'GET' }
  })

  // 7. Crear item con primera foto incluida en el multipart
  steps.push({
    id: crypto.randomUUID(),
    platform: 'wallapop',
    type: 'CREATE_WALLA_ITEM',
    request: {
      url: 'https://api.wallapop.com/api/v3/items',
      method: 'POST',
      isMultipart: true,
      photoUrl: listing.photo_url[0],
      photoIndex: 0,
      body: {} // relleno en processStepResult
    }
  })

  // 8. Fotos adicionales → /picture2, orden empieza en 2
  for (let i = 1; i < listing.photo_url.length; i++) {
    steps.push({
      id: crypto.randomUUID(),
      platform: 'wallapop',
      type: 'UPLOAD_WALLA_PHOTO',
      request: {
        url: 'DYNAMIC', 
        method: 'POST',
        isMultipart: true,
        photoUrl: listing.photo_url[i],
        photoIndex: i,
        body: { order: i + 1 }
      }
    })
  }

  // 9. Verificar item creado
  steps.push({
    id: crypto.randomUUID(),
    platform: 'wallapop',
    type: 'GET_WALLA_ITEM',
    request: { url: 'DYNAMIC', method: 'GET' }
  })

  return steps
}