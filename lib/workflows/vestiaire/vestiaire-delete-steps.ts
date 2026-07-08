/*
  Builder de pasos de un workflow concreto.
*/

import type { WorkflowStep } from '../types'

export function buildVestiaireDeleteListingSteps(externalId: string): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'vestiaire',
      type: 'DELETE_VEST_ITEM',
      request: {
        url: `https://apiv2.vestiairecollective.com/products/${externalId}/remove-from-sale?reasonId=change_of_mind&isoCountry=ES&x-siteid=12&x-language=es&x-currency=EURÇ`,
        method: 'POST',
        body: {
          reasonId: "change_of_mind",
          isoCountry: "ES"
        }
      }
    }
  ]
}