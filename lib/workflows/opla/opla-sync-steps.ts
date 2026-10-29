import type { WorkflowStep } from '../types'

const OPLA_ORIGIN = 'https://www.opla.co'

export function buildSearchOplaAccountSteps(): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'opla',
      type: 'GET_USER_ID',
      request: {
        url: `${OPLA_ORIGIN}/api/public/me`,
        method: 'GET',
        extractFromDom: 'userId',
      },
    },
  ]
}

export function buildSyncOplaAccountSteps(externalId: string): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'opla',
      type: 'CHECK_ACCOUNT',
      request: {
        url: `${OPLA_ORIGIN}/api/public/me`,
        method: 'GET',
        extractFromDom: 'userId',
        expectedUserId: externalId,
      },
    },
  ]
}
