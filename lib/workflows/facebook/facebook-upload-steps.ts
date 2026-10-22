import type { WorkflowStep } from '../types'
import { PLATFORM_PHOTO_LIMITS } from '@/app/inventory/listings/types'
import {
  FB_DOC_IDS,
  FB_FRIENDLY_NAMES,
  FB_COMPOSER_ROOT_VARIABLES,
  FB_GRAPHQL_URL,
  FB_ORIGIN,
  FB_UPLOAD_URL,
} from './facebook-constants'
import { mapFacebookCondition } from './facebook-helpers'

const FB_PHOTO_LIMIT = PLATFORM_PHOTO_LIMITS.facebook

export function buildFacebookUploadSteps(listing: any, externalId: string): WorkflowStep[] {
  mapFacebookCondition(listing.condition)

  const steps: WorkflowStep[] = [
    {
      id: crypto.randomUUID(),
      platform: 'facebook',
      type: 'GET_FB_USER',
      request: {
        url: `${FB_ORIGIN}/marketplace/`,
        method: 'GET',
        extractFromDom: 'userId',
        expectedUserId: externalId,
      },
    },
    {
      id: crypto.randomUUID(),
      platform: 'facebook',
      type: 'GET_FB_COMPOSER_CONTEXT',
      request: {
        url: FB_GRAPHQL_URL,
        method: 'POST',
        graphql: {
          friendlyName: FB_FRIENDLY_NAMES.COMPOSER_ROOT,
          docId: FB_DOC_IDS.COMPOSER_ROOT,
          variables: FB_COMPOSER_ROOT_VARIABLES,
        },
      },
    },
  ]

  const photos: string[] = listing.photoSelection?.facebook?.length
    ? listing.photoSelection.facebook
    : (listing.photo_url ?? [])
  if (!photos.length) throw new Error('Facebook Marketplace necesita al menos una foto.')
  if (photos.some(photo => typeof photo !== 'string' || !photo.trim())) {
    throw new Error('Facebook Marketplace recibió una URL de foto inválida.')
  }

  photos.slice(0, FB_PHOTO_LIMIT).forEach((photoUrl, i) => {
    steps.push({
      id: crypto.randomUUID(),
      platform: 'facebook',
      type: 'UPLOAD_FB_PHOTO',
      request: {
        url: FB_UPLOAD_URL,
        method: 'POST',
        isMultipart: true,
        photoUrl,
        photoIndex: i,
        body: {},
      },
    })
    if (i === 0) {
      steps.push({
        id: crypto.randomUUID(),
        platform: 'facebook',
        type: 'GET_FB_CATEGORY_PREDICTION',
        request: {
          url: FB_GRAPHQL_URL,
          method: 'POST',
          graphql: {
            friendlyName: FB_FRIENDLY_NAMES.CATEGORY_PREDICTION,
            docId: FB_DOC_IDS.CATEGORY_PREDICTION,
            variables: {},
          },
        },
      })
    }
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'facebook',
    type: 'CREATE_FB_LISTING',
    request: {
      url: FB_GRAPHQL_URL,
      method: 'POST',
      graphql: {
        friendlyName: FB_FRIENDLY_NAMES.CREATE_LISTING,
        docId: FB_DOC_IDS.CREATE_LISTING,
        variables: {},
      },
    },
  })

  return steps
}

export function buildSearchFacebookAccountSteps(): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'facebook',
      type: 'GET_FB_USER',
      request: { url: `${FB_ORIGIN}/marketplace/`, method: 'GET', extractFromDom: 'userId' },
    },
  ]
}

export function buildSyncFacebookAccountSteps(externalId: string): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'facebook',
      type: 'CHECK_ACCOUNT',
      request: {
        url: `${FB_ORIGIN}/marketplace/`,
        method: 'GET',
        extractFromDom: 'userId',
        expectedUserId: externalId,
      },
    },
  ]
}
