/*
  Builder de pasos de un workflow concreto.
*/

import type { WorkflowStep } from '../types'

export function buildSearchWallapopAccountSteps(): WorkflowStep[] {
  const steps: WorkflowStep[] = []

  steps.push({
    id: crypto.randomUUID(),
    platform: 'wallapop',
    type: 'GET_USER_ME',
    request: {
      url: 'https://api.wallapop.com/api/v3/users/me',
      method: 'GET'
    }
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'wallapop',
    type: 'GET_USER_TYPE',
    request: {
      url: 'https://api.wallapop.com/api/v3/user/type',
      method: 'GET'
    }
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'wallapop',
    type: 'GET_SUBSCRIPTIONS',
    request: {
      url: 'https://api.wallapop.com/api/v3/subscriptions',
      method: 'GET'
    }
  })

  return steps
}
export function buildSyncWallapopAccountSteps(): any[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'wallapop',
      type: 'GET_USER_ME',
      request: {
        url: 'https://api.wallapop.com/api/v3/users/me',
        method: 'GET'
      }
    }
  ]
}