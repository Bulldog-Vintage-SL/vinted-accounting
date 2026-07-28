/*
  Builder de pasos de un workflow concreto. (Subir producto a Vestiaire Collective).
  Los campos preduct_* se generan dinámicamente tras GET_VEST_FORM_OPTIONS (un campo por paso).
*/

import type { WorkflowStep } from '../types'

const BASE = 'https://apiv2.vestiairecollective.com'
const PARAMS = 'isoCountry=ES&x-siteid=12&x-language=en&x-currency=EUR'

export function buildVestiaireUploadSteps(listing: any): WorkflowStep[] {
  const steps: WorkflowStep[] = []

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vestiaire',
    type: 'GET_VEST_BRANDS',
    request: {
      url: `${BASE}/deposit/brands?${PARAMS}`,
      method: 'GET',
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vestiaire',
    type: 'GET_VEST_CATALOG',
    request: {
      url: `${BASE}/deposit/catalog?${PARAMS}`,
      method: 'GET',
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vestiaire',
    type: 'ADD_VEST_PRODUCT',
    request: {
      url: `${BASE}/deposit/addPreduct?${PARAMS}`,
      method: 'POST',
      body: {},
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vestiaire',
    type: 'GET_VEST_FORM_OPTIONS',
    request: {
      url: 'DYNAMIC',
      method: 'GET',
      extractFromDom: 'formOptions',
    },
  })

  for (let i = 0; i < listing.photo_url.length; i++) {
    steps.push({
      id: crypto.randomUUID(),
      platform: 'vestiaire',
      type: 'UPLOAD_VEST_PHOTO',
      request: {
        url: `${BASE}/deposit/photos`,
        method: 'POST',
        isMultipart: true,
        photoUrl: listing.photo_url[i],
        photoIndex: i + 1,
        body: {},
      },
    })
  }

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vestiaire',
    type: 'GET_VEST_PHOTOS',
    request: {
      url: 'DYNAMIC',
      method: 'GET',
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vestiaire',
    type: 'GET_VEST_ADDRESSES',
    request: {
      url: `${BASE}/users/addressV2?context=deposit`,
      method: 'GET',
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vestiaire',
    type: 'SET_VEST_SHIPPING_ADDRESS',
    request: {
      url: 'DYNAMIC',
      method: 'PUT',
      body: { flags: ['shipping'] },
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vestiaire',
    type: 'GET_VEST_DRAFT_DETAILS',
    request: {
      url: 'DYNAMIC',
      method: 'GET',
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'vestiaire',
    type: 'SUBMIT_VEST_PRODUCT',
    request: {
      url: 'DYNAMIC',
      method: 'PUT',
      isFormData: true,
      body: { withAddressV2: '1' },
    },
  })

  return steps
}
