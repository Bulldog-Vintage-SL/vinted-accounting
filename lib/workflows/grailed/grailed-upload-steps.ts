import type { WorkflowStep } from '../types'
import { PLATFORM_PHOTO_LIMITS } from '@/app/inventory/listings/types'
import { GRAILED_API_BASE } from './grailed-mapper'

export function buildGrailedUploadSteps(listing: any): WorkflowStep[] {
  const steps: WorkflowStep[] = []
  const brand = String(listing?.attributes?.brand ?? listing?.title ?? '').trim()

  steps.push({
    id: crypto.randomUUID(),
    platform: 'grailed',
    type: 'GET_GRAILED_USER_ID',
    request: {
      url: `${GRAILED_API_BASE}/`,
      method: 'GET',
      extractFromDom: 'userId',
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'grailed',
    type: 'GET_GRAILED_CATEGORIES',
    request: {
      url: `${GRAILED_API_BASE}/api/config/categories`,
      method: 'GET',
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'grailed',
    type: 'GET_GRAILED_DESIGNERS',
    request: {
      url: `${GRAILED_API_BASE}/api/designers?query=${encodeURIComponent(brand)}`,
      method: 'GET',
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'grailed',
    type: 'GET_GRAILED_USER',
    request: {
      url: '',
      method: 'GET',
    },
  })

  const grailedPhotos: string[] =
    listing.photoSelection?.grailed?.length
      ? listing.photoSelection.grailed
      : (listing.photo_url ?? []).slice(0, PLATFORM_PHOTO_LIMITS.grailed)

  const cappedPhotos = grailedPhotos.slice(0, PLATFORM_PHOTO_LIMITS.grailed)

  for (let i = 0; i < cappedPhotos.length; i++) {
    steps.push({
      id: crypto.randomUUID(),
      platform: 'grailed',
      type: 'UPLOAD_GRAILED_PHOTO',
      request: {
        url: `${GRAILED_API_BASE}/api/photos/presign/listing`,
        method: 'GET',
        photoUrl: cappedPhotos[i],
        photoIndex: i + 1,
      },
    })
  }

  steps.push({
    id: crypto.randomUUID(),
    platform: 'grailed',
    type: 'GET_GRAILED_SHIPPING',
    request: {
      url: '',
      method: 'GET',
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'grailed',
    type: 'CREATE_GRAILED_DRAFT',
    request: {
      url: `${GRAILED_API_BASE}/api/listing_drafts`,
      method: 'POST',
      body: {},
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'grailed',
    type: 'SUBMIT_GRAILED_DRAFT',
    request: {
      url: '',
      method: 'POST',
      body: {},
    },
  })

  return steps
}
