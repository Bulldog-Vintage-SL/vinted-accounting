/*
  Builder de pasos de un workflow concreto.
*/

import type { WorkflowStep } from '../types'
import {
  VESTIAIRE_SEARCH_URL,
  buildVestiaireSearchBody,
} from './vestiaire-import-steps'

export function buildGetVestiaireItemSteps(externalId: string): WorkflowStep[] {
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
