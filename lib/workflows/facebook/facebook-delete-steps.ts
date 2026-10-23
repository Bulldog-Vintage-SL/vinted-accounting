import type { WorkflowStep } from '../types'
import {
  FB_DOC_IDS,
  FB_FRIENDLY_NAMES,
  FB_GRAPHQL_URL,
  FB_ORIGIN,
} from './facebook-constants'

export function buildFacebookDeleteListingSteps(
  itemExternalId: string,
  externalId: string
): WorkflowStep[] {
  if (!itemExternalId.trim()) throw new Error('Falta el id de la publicación de Facebook.')
  if (!externalId.trim()) throw new Error('Falta el id de la cuenta de Facebook.')

  return [
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
      type: 'DELETE_FB_LISTING',
      request: {
        url: FB_GRAPHQL_URL,
        method: 'POST',
        graphql: {
          friendlyName: FB_FRIENDLY_NAMES.DELETE_LISTING,
          docId: FB_DOC_IDS.DELETE_LISTING,
          variables: {},
        },
      },
    },
  ]
}
