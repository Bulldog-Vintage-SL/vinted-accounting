import type { WorkflowStep } from '../types'

export function buildGetWallapopItemSteps(itemExternalId: string): WorkflowStep[] {
    const steps: WorkflowStep[] = []

    steps.push({
        id: crypto.randomUUID(),
        platform: 'wallapop',
        type: 'GET_WALLA_ITEM',
        request: { url: `https://api.wallapop.com/api/v3/items/${itemExternalId}`, method: 'GET' }
    })

    return steps;

}