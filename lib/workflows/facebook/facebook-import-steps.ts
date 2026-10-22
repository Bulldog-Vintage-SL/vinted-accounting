import type { WorkflowStep } from '../types'
import {
  FB_DOC_IDS,
  FB_FRIENDLY_NAMES,
  FB_GRAPHQL_URL,
  FB_INVENTORY_PAGE_SIZE,
  FB_INVENTORY_QUERY,
  FB_ORIGIN,
} from './facebook-constants'

export function buildImportFacebookInventorySteps(sellerId: string): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'facebook',
      type: 'GET_FB_USER',
      request: {
        url: `${FB_ORIGIN}/marketplace/`,
        method: 'GET',
        extractFromDom: 'userId',
      },
    },
    {
      id: crypto.randomUUID(),
      platform: 'facebook',
      type: 'GET_FB_INVENTORY',
      request: {
        url: FB_GRAPHQL_URL,
        method: 'POST',
        graphql: {
          docId: FB_INVENTORY_QUERY.docId,
          friendlyName: FB_INVENTORY_QUERY.friendlyName,
          variables: { scale: 1, sellerID: String(sellerId) },
        },
      },
    },
  ]
}

export function buildFacebookInventoryPaginationStep(
  sellerId: string,
  cursor: string
): WorkflowStep {
  const missingReason =
    !FB_DOC_IDS.INVENTORY_PAGINATION || !FB_FRIENDLY_NAMES.INVENTORY_PAGINATION
      ? 'Facebook Marketplace tiene más publicaciones, pero falta configurar ' +
        'FB_DOC_ID_INVENTORY_PAGINATION y FB_FRIENDLY_NAME_INVENTORY_PAGINATION ' +
        'con los valores capturados de la consulta de paginación.'
      : undefined

  return {
    id: crypto.randomUUID(),
    platform: 'facebook',
    type: 'GET_FB_INVENTORY',
    request: {
      url: FB_GRAPHQL_URL,
      method: 'POST',
      missingReason,
      graphql: {
        docId: FB_DOC_IDS.INVENTORY_PAGINATION,
        friendlyName: FB_FRIENDLY_NAMES.INVENTORY_PAGINATION,
        variables: {
          availabilities: ['IN_STOCK'],
          count: FB_INVENTORY_PAGE_SIZE,
          cursor,
          order: 'CREATION_TIMESTAMP_DESC',
          scale: 1,
          search: null,
          id: String(sellerId),
        },
      },
    },
  }
}
