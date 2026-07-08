import type { WorkflowStep } from '../types'
 
export function buildUpdateWallapopItemSteps(itemExternalId: string): WorkflowStep[] {
  const steps: WorkflowStep[] = []
 
  steps.push({
    id: crypto.randomUUID(),
    platform: 'wallapop',
    type: 'GET_WALLA_ITEM',
    request: {
      url: `https://api.wallapop.com/api/v3/items/${itemExternalId}`,
      method: 'GET'
    }
  })
 
  steps.push({
    id: crypto.randomUUID(),
    platform: 'wallapop',
    type: 'UPDATE_WALLA_ITEM',
    request: {
      url: `https://api.wallapop.com/api/v3/items/${itemExternalId}`,
      method: 'PUT'
    }
  })
 
  return steps
}
 