import type { WorkflowStep } from '../types'

const BASE = 'https://webapi.depop.com'
const DEPOP_PHOTO_LIMIT = 4

export function buildDepopUploadSteps(listing: any): WorkflowStep[] {
  const steps: WorkflowStep[] = []

  steps.push({
    id: crypto.randomUUID(),
    platform: 'depop',
    type: 'GET_DEPOP_SELLER_STATUS',
    request: {
      url: `${BASE}/api/v1/sellerOnboarding/sellerStatus/`,
      method: 'GET',
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'depop',
    type: 'GET_DEPOP_COUNTRIES',
    request: {
      url: 'https://assets.depop.com/web/assets/listing/location/countries.json',
      method: 'GET',
      noAuth: true,
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'depop',
    type: 'GET_DEPOP_CATEGORY_FILTERS',
    request: {
      url: `${BASE}/api/v3/search/categoryFilters/?lang=en-US`,
      method: 'GET',
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'depop',
    type: 'GET_DEPOP_USER_SETTINGS',
    request: {
      url: `${BASE}/api/v1/user/settings/`,
      method: 'GET',
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'depop',
    type: 'GET_DEPOP_PRODUCT_ATTRIBUTES',
    request: {
      url: `${BASE}/api/v2/search/filters/productAttributes/?country=en`,
      method: 'GET',
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'depop',
    type: 'GET_DEPOP_BANNED_HASHTAGS',
    request: {
      url: `${BASE}/presentation/api/v1/listing/banned-hashtags/`,
      method: 'GET',
    },
  }) 

  const depopPhotos: string[] =
    listing.photoSelection?.["depop"]?.length
      ? listing.photoSelection["depop"]
      : (listing.photo_url ?? []).slice(0, DEPOP_PHOTO_LIMIT);

  const cappedDepopPhotos = depopPhotos.slice(0, DEPOP_PHOTO_LIMIT);

  for (let i = 0; i < cappedDepopPhotos.length; i++) {
    steps.push({
      id: crypto.randomUUID(),
      platform: 'depop',
      type: 'UPLOAD_DEPOP_PHOTO',
      request: {
        url: `${BASE}/presentation/api/v1/pictures/`,
        method: 'POST',
        photoUrl: cappedDepopPhotos[i],
        photoIndex: i + 1,
        isPictureUpload: true,
        body: {
          type: 'product',
          extension: 'jpg',
          dimensions: { width: 1280, height: 1280 },
        },
      },
    })
  }

  steps.push({
    id: crypto.randomUUID(),
    platform: 'depop',
    type: 'PREDICT_DEPOP_CATEGORY',
    request: {
      url: `${BASE}/presentation/api/v1/attributes/categories/prediction/`,
      method: 'POST',
      body: {},
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'depop',
    type: 'GET_DEPOP_SIZE_MAPPING',
    request: {
      url: `${BASE}/presentation/api/v1/attributes/categories/size-mapping/`,
      method: 'GET',
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'depop',
    type: 'GET_DEPOP_SIZE_FILTERS',
    request: {
      url: `${BASE}/presentation/api/v1/search/sizeFilters/`,
      method: 'GET',
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'depop',
    type: 'GET_DEPOP_PRICING_INSPIRATION',
    request: {
      url: `${BASE}/api/v2/analytics/products/pricing-inspiration/`,
      method: 'POST',
      body: {},
    },
  })

  steps.push({
    id: crypto.randomUUID(),
    platform: 'depop',
    type: 'SUBMIT_DEPOP_PRODUCT',
    request: {
      url: `${BASE}/presentation/api/v1/listing/products/`,
      method: 'POST',
      body: {},
    },
  })

  return steps
}