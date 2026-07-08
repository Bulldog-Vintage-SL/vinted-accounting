import type { WorkflowStep } from '../types'

export function buildGetVintedItemSteps(itemExternalId: string): WorkflowStep[] {
    const steps: WorkflowStep[] = []

    steps.push({
        id: crypto.randomUUID(),
        platform: 'vinted',
        type: 'GET_VINT_ITEM',
        request: { url: `https://www.vinted.es/api/v2/item_upload/items/${itemExternalId}`, method: 'GET' }
    })


    return steps;


}