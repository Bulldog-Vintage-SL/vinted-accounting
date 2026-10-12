import type { WorkflowStep } from '../types'
import { PLATFORM_PHOTO_LIMITS } from '@/app/inventory/listings/types'
import {
  MILANUNCIOS_CLASSIFIEDS,
  MILANUNCIOS_USERPROFILES,
} from './milanuncios-constants'

export function buildMilanunciosUploadSteps(listing: any): WorkflowStep[] {
  const steps: WorkflowStep[] = []

  steps.push({
    id: crypto.randomUUID(),
    platform: 'milanuncios',
    type: 'GET_MA_USER',
    request: {
      url: `${MILANUNCIOS_USERPROFILES}/v1/users/me/profiles/private`,
      method: 'GET',
      extractFromDom: 'userId',
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'milanuncios',
    type: 'GET_MA_CATEGORIES',
    request: {
      url: `${MILANUNCIOS_CLASSIFIEDS}/v1/category-trees/pta`,
      method: 'GET',
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'milanuncios',
    type: 'GET_MA_PTA_FORM',
    request: {
      url: 'DYNAMIC',
      method: 'GET',
    },
  })

  // Orden SPA: location → POST draft {userId,categoryId} → profile → PUT draft
  steps.push({
    id: crypto.randomUUID(),
    platform: 'milanuncios',
    type: 'GET_MA_LOCATION',
    request: {
      url: 'DYNAMIC',
      method: 'GET',
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'milanuncios',
    type: 'CREATE_MA_DRAFT',
    request: {
      url: `${MILANUNCIOS_CLASSIFIEDS}/api/v2/classifieds/draft`,
      method: 'POST',
      body: {},
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'milanuncios',
    type: 'GET_MA_PUBLIC_PROFILE',
    request: {
      url: 'DYNAMIC',
      method: 'GET',
    },
  })

  // El anuncio completo va en POST /classifieds (no en PUT /draft).

  const photos: string[] =
    listing.photoSelection?.milanuncios?.length
      ? listing.photoSelection.milanuncios
      : (listing.photo_url ?? []).slice(0, PLATFORM_PHOTO_LIMITS.milanuncios)

  const capped = photos.slice(0, PLATFORM_PHOTO_LIMITS.milanuncios)

  for (let i = 0; i < capped.length; i++) {
    steps.push({
      id: crypto.randomUUID(),
      platform: 'milanuncios',
      type: 'UPLOAD_MA_PHOTO',
      request: {
        url: 'DYNAMIC',
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
    platform: 'milanuncios',
    type: 'PUBLISH_MA_CLASSIFIED',
    request: {
      url: `${MILANUNCIOS_CLASSIFIEDS}/api/v2/classifieds`,
      method: 'POST',
      body: {},
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'milanuncios',
    type: 'GET_MA_PUBLICATION_REQUIREMENTS',
    request: {
      url: 'DYNAMIC',
      method: 'GET',
    },
  })

  return steps
}

export function buildMilanunciosPtaFormUrl(categoryId: string): string {
  return `${MILANUNCIOS_CLASSIFIEDS}/v1/pta-form/${encodeURIComponent(categoryId)}?fields=form_id`
}

export function buildMilanunciosMediaDraftUrl(userId: string, adId: string): string {
  const params = new URLSearchParams({ userId, adId })
  return `${MILANUNCIOS_CLASSIFIEDS}/api/v2/classified-media/draft?${params}`
}

export function buildMilanunciosPublicProfileUrl(userId: string): string {
  return `${MILANUNCIOS_USERPROFILES}/v1/users/${encodeURIComponent(userId)}/profiles/public`
}

export function buildMilanunciosCurrentLocationUrl(userId: string): string {
  return `${MILANUNCIOS_CLASSIFIEDS}/api/v1/users/${encodeURIComponent(userId)}/locations/current`
}

export function buildMilanunciosPublicationRequirementsUrl(adId: string): string {
  return `${MILANUNCIOS_CLASSIFIEDS}/v1/classifieds/${encodeURIComponent(adId)}/publication-requirements?transactionType=OFFER`
}
