import type { WorkflowStep } from '../types'
import { TC_ORIGIN } from './todocoleccion-constants'

export function buildSearchTodocoleccionAccountSteps(): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'todocoleccion',
      type: 'GET_TC_USER_ID',
      request: {
        url: `${TC_ORIGIN}/mitc/`,
        method: 'GET',
        extractFromDom: 'userId',
      },
    },
  ]
}

export function buildSyncTodocoleccionAccountSteps(externalId: string): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      type: 'CHECK_ACCOUNT',
      platform: 'todocoleccion',
      request: {
        url: `${TC_ORIGIN}/mitc/`,
        method: 'GET',
        extractFromDom: 'userId',
        expectedUserId: externalId,
      },
    },
  ]
}
