import type { WorkflowStep } from '../types'
import { PLATFORM_PHOTO_LIMITS } from '@/app/inventory/listings/types'

export function buildWallapopSteps(listing: any): WorkflowStep[] {
  const steps: WorkflowStep[] = []

  steps.push({
    id: crypto.randomUUID(),
    platform: 'wallapop',
    type: 'GET_USER_ME',
    request: { url: 'https://api.wallapop.com/api/v3/users/me', method: 'GET' }
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'wallapop',
    type: 'GET_WALLA_CATEGORIES',
    request: { url: 'https://api.wallapop.com/api/v3/categories', method: 'GET' }
  })

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

  steps.push({
    id: crypto.randomUUID(),
    platform: 'wallapop',
    type: 'GET_WALLA_WEIGHT_TIERS',
    request: { url: 'DYNAMIC', method: 'GET' }
  })

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

  steps.push({
    id: crypto.randomUUID(),
    platform: 'wallapop',
    type: 'GET_WALLA_WEIGHT_TIERS',
    request: { url: 'DYNAMIC', method: 'GET' }
  })

  const wallapopPhotos: string[] =
    listing.photoSelection?.['wallapop']?.length
      ? listing.photoSelection['wallapop']
      : (listing.photo_url ?? []).slice(0, PLATFORM_PHOTO_LIMITS.wallapop)

  const cappedWallapopPhotos = wallapopPhotos.slice(0, PLATFORM_PHOTO_LIMITS.wallapop)

  steps.push({
    id: crypto.randomUUID(),
    platform: 'wallapop',
    type: 'CREATE_WALLA_ITEM',
    request: {
      url: 'https://api.wallapop.com/api/v3/items',
      method: 'POST',
      isMultipart: true,
      photoUrl: cappedWallapopPhotos[0],
      photoIndex: 0,
      body: {} 
    }
  })

  for (let i = 1; i < cappedWallapopPhotos.length; i++) {
    steps.push({
      id: crypto.randomUUID(),
      platform: 'wallapop',
      type: 'UPLOAD_WALLA_PHOTO',
      request: {
        url: 'DYNAMIC', 
        method: 'POST',
        isMultipart: true,
        photoUrl: cappedWallapopPhotos[i],
        photoIndex: i,
        body: { order: i + 1 }
      }
    })
  }

  steps.push({
    id: crypto.randomUUID(),
    platform: 'wallapop',
    type: 'GET_WALLA_ITEM',
    request: { url: 'DYNAMIC', method: 'GET' }
  })

  return steps
}