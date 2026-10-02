import type { WorkflowStep } from '../types'
import { GRAILED_API_BASE } from './grailed-mapper'

export function buildSearchGrailedAccountSteps(): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'grailed',
      type: 'GET_GRAILED_USER_ID',
      request: {
        url: `${GRAILED_API_BASE}/`,
        method: 'GET',
        extractFromDom: 'userId',
      },
    },
  ]
}

export function buildSyncGrailedAccountSteps(externalId: string): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      type: 'CHECK_ACCOUNT',
      platform: 'grailed',
      request: {
        url: `${GRAILED_API_BASE}/`,
        method: 'GET',
        extractFromDom: 'userId',
        expectedUserId: externalId,
      },
    },
  ]
}
