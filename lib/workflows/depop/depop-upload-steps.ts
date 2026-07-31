import type { WorkflowStep } from '../types'

export function buildDepopUploadSteps(): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      type: 'GET_DEPOP_USER_ID',
      platform: 'depop',
      request: {
        url: '',
        method: 'GET',
        extractFromDom: 'userId'
      }
    },
    {
      id: crypto.randomUUID(),
      type: 'GET_DEPOP_CATEGORY_PREDICTION',
      platform: 'depop',
      request: {
        url: 'https://webapi.depop.com/presentation/api/v1/attributes/categories/prediction/',
        method: 'POST'
      }
    }
  ]
}