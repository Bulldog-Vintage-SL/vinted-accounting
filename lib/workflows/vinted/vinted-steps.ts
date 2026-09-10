/*
  Builder de pasos de un workflow concreto. (Subir producto a Vinted).
*/

import type { WorkflowStep } from '../types'
import { PLATFORM_PHOTO_LIMITS } from '@/app/inventory/listings/types'

export function buildVintedSteps(listing: any, uploadSessionId: string): WorkflowStep[] {
  const steps: WorkflowStep[] = []

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vinted',
    type: 'GET_ITEMS_NEW',
    request: {
      url: 'https://www.vinted.es/items/new',
      method: 'GET'
    }
  }) 

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vinted',
    type: 'GET_CONFIGURATION',
    request: {
      url: 'https://www.vinted.es/api/v2/items/configuration',
      method: 'GET'
    }
  })

  const vintedPhotos: string[] =
    listing.photoSelection?.['vinted']?.length
      ? listing.photoSelection['vinted']
      : (listing.photo_url ?? []).slice(0, PLATFORM_PHOTO_LIMITS.vinted)

  const cappedVintedPhotos = vintedPhotos.slice(0, PLATFORM_PHOTO_LIMITS.vinted)

  for (let i = 0; i < cappedVintedPhotos.length; i++) {
    steps.push({
      id: crypto.randomUUID(),
      platform: 'vinted',
      type: 'UPLOAD_PHOTO',
      request: {
        url: 'https://www.vinted.es/api/v2/photos',
        method: 'POST',
        isMultipart: true,
        photoUrl: cappedVintedPhotos[i],
        photoIndex: i,
        body: {
          order: i,
          is_main: i === 0,
          upload_session_id: uploadSessionId
        }
      }
    })
  }
  /*
  
  steps.push({
    id: crypto.randomUUID(),
    platform: 'vinted',
    type: 'GET_CATEGORY_SUGGESTIONS',
    request: {
      url: 'DYNAMIC',
      method: 'GET'
    }
  })
  
  */
  

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vinted',
    type: 'GET_PACKAGE_SUGGESTION',
    request: {
      url: 'https://api.vinted.es/shipping-estimation/external/package_sizes/suggestion',
      method: 'POST',
      body: {}
    }
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vinted',
    type: 'GET_ITEM_ATTRIBUTES',
    request: {
      url: 'DYNAMIC',
      method: 'POST',
      body: {}
    }
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vinted',
    type: 'GET_BRAND',
    request: {
      url: `https://www.vinted.es/api/v2/brands?keyword=${encodeURIComponent(listing.attributes?.brand)}&all_brands=True`,
      method: 'GET'
    }
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vinted',
    type: 'GET_COLORS',
    request: {
      url: 'https://www.vinted.es/api/v2/colors',
      method: 'GET'
    }
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vinted',
    type: 'CREATE_ITEM',
    request: {
      url: 'https://www.vinted.es/api/v2/item_upload/items',
      method: 'POST',
      body: {}
    }
  })

  return steps
}