import type { WorkflowStep } from '../types'

const BASE = 'https://webapi.depop.com'

export function buildDepopGetItemSteps(slug: string): WorkflowStep[] {
    return [
        {
            id: crypto.randomUUID(),
            platform: 'depop',
            type: 'GET_DEPOP_ITEM',
            request: {
                url: `${BASE}/presentation/api/v1/products/by-slug/${slug}/edit-listing/`,
                method: 'GET',
            },
        },
    ]
}

export function buildDepopUpdateSteps(slug: string): WorkflowStep[] {
    return [
        {
            id: crypto.randomUUID(),
            platform: 'depop',
            type: 'GET_DEPOP_ITEM',
            request: {
                url: `${BASE}/presentation/api/v1/products/by-slug/${slug}/edit-listing/`,
                method: 'GET',
            },
        },
        {
            id: crypto.randomUUID(),
            platform: 'depop',
            type: 'GET_DEPOP_COUNTRIES',
            request: {
                url: 'https://assets.depop.com/web/assets/listing/location/countries.json',
                method: 'GET',
                noAuth: true,
            },
        },
        {
            id: crypto.randomUUID(),
            platform: 'depop',
            type: 'UPDATE_DEPOP_ITEM',
            request: {
                url: `${BASE}/presentation/api/v1/products/by-slug/${slug}/`,
                method: 'PUT',
                body: {},
            },
        },
    ]
}