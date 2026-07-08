/*
  Builder de pasos de un workflow concreto. (Subir producto a Vestiaire Collective).
*/

import type { WorkflowStep } from '../types'

const BASE = 'https://apiv2.vestiairecollective.com'
const PARAMS = 'isoCountry=ES&x-siteid=12&x-language=es&x-currency=EUR'

export function buildVestiaireUploadSteps(listing: any): WorkflowStep[] {
  const steps: WorkflowStep[] = []

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vestiaire',
    type: 'GET_VEST_BRANDS',
    request: {
      url: `${BASE}/deposit/brands?${PARAMS}`,
      method: 'GET'
    }
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vestiaire',
    type: 'GET_VEST_CATALOG',
    request: {
      url: `${BASE}/deposit/catalog?${PARAMS}`,
      method: 'GET'
    }
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vestiaire',
    type: 'ADD_VEST_PRODUCT',
    request: {
      url: `${BASE}/deposit/addPreduct?${PARAMS}`,
      method: 'POST',
      body: {}
    }
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vestiaire',
    type: 'GET_VEST_FORM_OPTIONS',
    request: {
      url: 'DYNAMIC',
      method: 'GET',
      extractFromDom: 'formOptions'
    }
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vestiaire',
    type: 'FILL_VEST_FIELDS',
    request: {
      url: 'DYNAMIC',
      method: 'POST',
      isFormData: true,
      body: {}
    }
  })

  for (let i = 0; i < listing.photo_url.length; i++) {
    steps.push({
      id: crypto.randomUUID(),
      platform: 'vestiaire',
      type: 'UPLOAD_VEST_PHOTO',
      request: {
        url: `${BASE}/deposit/photos`,
        method: 'POST',
        isMultipart: true,
        photoUrl: listing.photo_url[i],
        photoIndex: i,
        body: {}
      }
    })
  }

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vestiaire',
    type: 'GET_VEST_PHOTOS',
    request: {
      url: 'DYNAMIC', // /deposit/photos/products/drafts/:draftId
      method: 'GET'
    }
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vestiaire',
    type: 'FILL_VEST_DESCRIPTION',
    request: {
      url: 'DYNAMIC',
      method: 'POST',
      isFormData: true,
      body: {} // relleno dinámico
    }
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vestiaire',
    type: 'GET_VEST_ADDRESSES',
    request: {
      url: `${BASE}/users/addressV2?context=deposit`,
      method: 'GET'
    }
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vestiaire',
    type: 'SET_VEST_SHIPPING_ADDRESS',
    request: {
      url: 'DYNAMIC', // /users/me/addresses/:addressId/flags
      method: 'PUT',
      body: { flags: ['shipping'] }
    }
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vestiaire',
    type: 'GET_VEST_DRAFT_DETAILS',
    request: {
      url: 'DYNAMIC', // /product-listing/product-drafts/:draftId/details
      method: 'GET'
    }
  })

  // 10. Enviar el draft
  steps.push({
    id: crypto.randomUUID(),
    platform: 'vestiaire',
    type: 'SUBMIT_VEST_PRODUCT',
    request: {
      url: 'DYNAMIC', // /deposit/products/drafts/:draftId/submit
      method: 'PUT',
      isFormData: true,
      body: { withAddressV2: '1' }
    }
  })

  /*

 
  

  // 4. Rellenar campos del draft (condition, material, color, pattern, size_unit, size, pvp)
  //    Se manda como FormData en el content script
 
  

  // 5. Subir fotos (una por una)
  

  // 6. Verificar que las fotos se han subido correctamente
  

  // 7. Rellenar descripción (mismo endpoint PATCH que FILL_VEST_FIELDS pero solo description)
  

  // 8. Obtener direcciones del usuario para elegir la de envío
  

  // 9. Seleccionar dirección de envío
  

  
  */

  return steps

}