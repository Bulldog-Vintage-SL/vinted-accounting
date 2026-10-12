import type { WorkflowStep } from '../types'
import { MILANUNCIOS_ORIGIN, MILANUNCIOS_USERPROFILES } from './milanuncios-constants'

export function buildSearchMilanunciosAccountSteps(): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'milanuncios',
      type: 'GET_MA_USER',
      request: {
        url: `${MILANUNCIOS_USERPROFILES}/v1/users/me/profiles/private`,
        method: 'GET',
        extractFromDom: 'userId',
      },
    },
  ]
}

export function buildSyncMilanunciosAccountSteps(externalId: string): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'milanuncios',
      type: 'CHECK_ACCOUNT',
      request: {
        url: MILANUNCIOS_ORIGIN + '/',
        method: 'GET',
        extractFromDom: 'userId',
        expectedUserId: externalId,
      },
    },
  ]
}
