import type { WorkflowStep } from '../types'

const BASE = 'https://webapi.depop.com'

export function buildDepopDeleteSteps(externalId: string): WorkflowStep[] {
    return [
        {
            id: crypto.randomUUID(),
            platform: 'depop',
            type: 'DELETE_DEPOP_PRODUCT',
            request: {
                url: `${BASE}/presentation/api/v1/products/${externalId}/`,
                method: 'DELETE',
            },
        },
    ]
}