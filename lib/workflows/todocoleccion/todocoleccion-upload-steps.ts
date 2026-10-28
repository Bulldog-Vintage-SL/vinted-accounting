import type { WorkflowStep } from '../types'
import { PLATFORM_PHOTO_LIMITS } from '@/app/inventory/listings/types'
import {
  TC_API,
  TC_CREATE_LOTE_URL,
  TC_NEW_LOTE_URL,
  TC_ORIGIN,
  TC_UPLOAD_IMAGE_URL,
} from './todocoleccion-constants'
import { todocoleccionSectionQuery } from './todocoleccion-mapper'

export function buildTodocoleccionUploadSteps(listing: any): WorkflowStep[] {
  const steps: WorkflowStep[] = []
  const sectionQuery = todocoleccionSectionQuery(listing)

  steps.push({
    id: crypto.randomUUID(),
    platform: 'todocoleccion',
    type: 'GET_TC_USER_ID',
    request: {
      url: `${TC_ORIGIN}/mitc/`,
      method: 'GET',
      extractFromDom: 'userId',
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'todocoleccion',
    type: 'GET_TC_NEW_LOTE',
    request: {
      url: TC_NEW_LOTE_URL,
      method: 'GET',
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'todocoleccion',
    type: 'GET_TC_SECTIONS',
    request: {
      url: `${TC_API}/filters/getRecommendedSectionsByText?text=${encodeURIComponent(sectionQuery)}`,
      method: 'GET',
    },
  })

  const photos: string[] =
    listing.photoSelection?.todocoleccion?.length
      ? listing.photoSelection.todocoleccion
      : (listing.photo_url ?? []).slice(0, PLATFORM_PHOTO_LIMITS.todocoleccion)

  const capped = photos.slice(0, PLATFORM_PHOTO_LIMITS.todocoleccion)
  if (!capped.length) {
    throw new Error('todocoleccion necesita al menos una foto.')
  }

  for (let i = 0; i < capped.length; i++) {
    steps.push({
      id: crypto.randomUUID(),
      platform: 'todocoleccion',
      type: 'UPLOAD_TC_PHOTO',
      request: {
        url: TC_UPLOAD_IMAGE_URL,
        method: 'POST',
        isMultipart: true,
        photoUrl: capped[i],
        photoIndex: i,
        body: {},
      },
    })
  }

  steps.push({
    id: crypto.randomUUID(),
    platform: 'todocoleccion',
    type: 'GET_TC_SHIPPING',
    request: {
      url: '',
      method: 'GET',
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'todocoleccion',
    type: 'CREATE_TC_LOTE',
    request: {
      url: TC_CREATE_LOTE_URL,
      method: 'POST',
      isFormData: true,
      body: {},
    },
  })

  return steps
}
