/*
  Builder de pasos de un workflow concreto.
*/

import type { WorkflowStep } from '../types'

export const VESTIAIRE_SEARCH_LIMIT = 60
export const VESTIAIRE_SEARCH_URL = 'https://search.vestiairecollective.com/v1/product/search'

export function buildVestiaireSearchBody(externalId: string, offset: number) {
  return {
    pagination: { limit: VESTIAIRE_SEARCH_LIMIT, offset },
    fields: ['name', 'description', 'brand', 'pictures', 'price', 'colors', 'size', 'link', 'sold', 'createdAt', 'universeId'],
    locale: { country: 'ES', language: 'es', currency: 'EUR', sizeType: 'ES' },
    filters: { 'seller.id': [externalId], sold: ['0'] },
    mySizes: null,
    sortBy: 'relevance'
  }
}

export function buildImportVestiaireSteps(externalId: string): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'vestiaire',
      type: 'GET_ITEMS_NEW',
      request: {
        url: VESTIAIRE_SEARCH_URL,
        method: 'POST',
        body: buildVestiaireSearchBody(externalId, 0)
      }
    }
  ]
}
