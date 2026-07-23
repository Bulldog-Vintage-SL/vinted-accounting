import type { WorkflowStep } from '../types'

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
      body: {} 
    }
  })

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

  steps.push({
    id: crypto.randomUUID(),
    platform: 'wallapop',
    type: 'GET_WALLA_ITEM',
    request: { url: 'DYNAMIC', method: 'GET' }
  })

  return steps
}