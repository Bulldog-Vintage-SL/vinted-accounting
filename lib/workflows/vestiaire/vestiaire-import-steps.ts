/*
  Builder de pasos de un workflow concreto.
*/

import type { WorkflowStep } from '../types'

export function buildImportVestiaireSteps(externalId: string): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'vestiaire',
      type: 'GET_ITEMS_NEW',
      request: {
        url: 'https://search.vestiairecollective.com/v1/product/search',
        method: 'POST',
        body: {
          pagination: { limit: 60, offset: 0 },
          fields: ['name', 'description', 'brand', 'pictures', 'price', 'colors', 'size', 'link', 'sold', 'createdAt', 'universeId'],
          locale: { country: 'ES', language: 'es', currency: 'EUR', sizeType: 'ES' },
          filters: { 'seller.id': [externalId], sold: ['0'] },
          mySizes: null,
          sortBy: 'relevance'
        }
      }
    }
  ]
}