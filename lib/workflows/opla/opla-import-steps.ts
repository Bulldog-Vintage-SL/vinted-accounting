import type { WorkflowStep } from '../types'

const OPLA_API = 'https://www.opla.co/api/public'

export function buildImportOplaWardrobeSteps(): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'opla',
      type: 'GET_OPLA_WARDROBE',
      request: {
        url: `${OPLA_API}/me/articles?view=summary&limit=200&includeSold=true`,
        method: 'GET',
      },
    },
  ]
}
