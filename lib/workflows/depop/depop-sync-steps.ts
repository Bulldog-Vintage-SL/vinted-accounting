/*
  Builder de pasos de un workflow concreto. (Buscar / sincronizar cuenta de Depop).
*/

import type { WorkflowStep } from '../types'

export function buildSearchDepopAccountSteps(): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'depop',
      type: 'GET_DEPOP_USER_ID',
      request: {
        url: 'https://www.depop.com/',
        method: 'GET',
        extractFromDom: 'userId'
      }
    }

  ]
}

export function buildSyncDepopAccountSteps(externalId: string): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      type: 'CHECK_ACCOUNT',
      platform: 'depop',
      request: {
        url: 'https://www.depop.com/',
        method: 'GET',
        extractFromDom: 'userId',
        expectedUserId: externalId
      }
    }
  ]
}