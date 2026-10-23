import type { WorkflowStep } from '../types'
import {
  FB_DOC_IDS,
  FB_FRIENDLY_NAMES,
  FB_GRAPHQL_URL,
  FB_LISTING_FOR_EDIT_VARIABLES,
  FB_ORIGIN,
} from './facebook-constants'

function buildFacebookEditAuthStep(externalId: string): WorkflowStep {
  if (!externalId.trim()) throw new Error('Falta el id de la cuenta de Facebook.')
  return {
    id: crypto.randomUUID(),
    platform: 'facebook',
    type: 'GET_FB_USER',
    request: {
      url: `${FB_ORIGIN}/marketplace/`,
      method: 'GET',
      extractFromDom: 'userId',
      expectedUserId: externalId,
    },
  }
}

export function buildFacebookGetListingSteps(
  itemExternalId: string,
  externalId: string,
  itemLookupId = itemExternalId
): WorkflowStep[] {
  if (!itemExternalId.trim()) throw new Error('Falta el id de la publicación de Facebook.')
  if (!itemLookupId.trim()) throw new Error('Falta el id público de la publicación de Facebook.')

  return [
    buildFacebookEditAuthStep(externalId),
    {
      id: crypto.randomUUID(),
      platform: 'facebook',
      type: 'GET_FB_LISTING_FOR_EDIT',
      request: {
        url: FB_GRAPHQL_URL,
        method: 'POST',
        graphql: {
          friendlyName: FB_FRIENDLY_NAMES.GET_LISTING_FOR_EDIT,
          docId: FB_DOC_IDS.GET_LISTING_FOR_EDIT,
          variables: {
            ...FB_LISTING_FOR_EDIT_VARIABLES,
            targetId: itemLookupId,
          },
        },
      },
    },
  ]
}

export function buildFacebookUpdateListingSteps(
  itemExternalId: string,
  externalId: string
): WorkflowStep[] {
  if (!itemExternalId.trim()) throw new Error('Falta el id de la publicación de Facebook.')

  return [
    buildFacebookEditAuthStep(externalId),
    {
      id: crypto.randomUUID(),
      platform: 'facebook',
      type: 'UPDATE_FB_LISTING',
      request: {
        url: FB_GRAPHQL_URL,
        method: 'POST',
        graphql: {
          friendlyName: FB_FRIENDLY_NAMES.UPDATE_LISTING,
          docId: FB_DOC_IDS.UPDATE_LISTING,
          variables: {},
        },
      },
    },
  ]
}
