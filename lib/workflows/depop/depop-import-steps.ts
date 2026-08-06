/*
  Builder de pasos de un workflow concreto.
*/

import type { WorkflowStep } from '../types'

const BASE = 'https://webapi.depop.com'

export function buildImportDepopWardrobeSteps(userId: string): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      type: 'GET_DEPOP_WARDROBE',
      platform: 'depop',
      request: {
        url: `https://webapi.depop.com/api/v3/shop/${userId}/products/?limit=24`,
        method: 'GET'
      }
    }
  ]
} 