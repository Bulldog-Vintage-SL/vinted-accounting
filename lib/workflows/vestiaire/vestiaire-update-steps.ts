/*
  Builder de pasos de un workflow concreto.
*/

import type { WorkflowStep } from '../types'

export function buildUpdateVestiaireItemSteps(userExternalId: string, externalId: string, newPrice: number): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'vestiaire',
      type: 'UPDATE_VEST_ITEM',
      request: {
        url: `https://apiv2.vestiairecollective.com/users/me/products/price-drop?isoCountry=ES&x-siteid=12&x-language=es&x-currency=EUR`,
        method: 'POST',
        body: [
          {
            id: userExternalId,
            type: "priceDrop",
            price: newPrice,
            productId: externalId
          }
        ]
      }
    }
  ]
}