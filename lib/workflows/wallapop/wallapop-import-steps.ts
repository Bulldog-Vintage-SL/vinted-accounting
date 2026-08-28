/*
  Builder de pasos de un workflow concreto.
*/

import type { WorkflowStep } from '../types'

export function buildWallapopImportSteps(): WorkflowStep[] {
    const steps: WorkflowStep[] = []

    steps.push({
        id: crypto.randomUUID(),
        platform: 'wallapop',
        type: 'GET_WALLA_WARDROBE',
        request: {
            // La paginación (since/start) la encola el step-executor.
            url: 'https://api.wallapop.com/api/v3/user/items',
            method: 'GET'
        }
    });

    return steps;
}