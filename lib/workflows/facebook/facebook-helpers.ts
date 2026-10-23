import { FB_CATEGORY_IDS, FB_DEFAULT_LOCATION, FB_ORIGIN } from './facebook-constants'

export function throwFacebookGraphqlErrors(result: any): void {
  const errors = result?.errors
  if (!Array.isArray(errors) || !errors.length) return

  const message = errors
    .map((error: any) => error?.message)
    .filter((value: any): value is string => typeof value === 'string' && Boolean(value.trim()))
    .join('; ')
  throw new Error(message || 'Facebook rechazó la operación GraphQL.')
}

export function pickFacebookUserId(result: any): string | null {
  const id = result?.userId ?? result?.id
  return id != null && String(id).trim() ? String(id) : null
}

export function extractFacebookInventoryPage(result: any): {
  items: any[]
  endCursor: string | null
  hasNextPage: boolean
} {
  const connection =
    result?.data?.profile?.marketplace_listing_sets ??
    result?.data?.node?.marketplace_listing_sets
  const edges = Array.isArray(connection?.edges) ? connection.edges : []
  const items = edges
    .map((edge: any) => edge?.node?.canonical_listing ?? edge?.node?.marketplace_listing ?? edge?.node)
    .filter((item: any) => item && typeof item === 'object' && item.id != null)

  return {
    items,
    endCursor: connection?.page_info?.end_cursor ?? null,
    hasNextPage: connection?.page_info?.has_next_page === true,
  }
}

export function pickFacebookListing(result: any): { id: string | null; url: string | null } {
  const root = result?.data ?? result
  const node =
    root?.marketplace_listing_create?.listing ??
    root?.marketplace_listing_create?.marketplace_listing ??
    root?.xfb_marketplace_listing_create?.listing ??
    findFirstKey(root, 'marketplace_listing') ??
    findFirstKey(root, 'listing')

  const id = node?.id ?? node?.listing_id ?? null
  return {
    id: id != null ? String(id) : null,
    url: node?.story?.url ?? (id != null ? `${FB_ORIGIN}/marketplace/item/${id}` : null),
  }
}

function findFacebookDescription(value: any, depth = 0): string | null {
  if (!value || typeof value !== 'object' || depth > 10) return null
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFacebookDescription(item, depth + 1)
      if (found !== null) return found
    }
    return null
  }

  for (const key of ['redacted_description', 'description', 'description_text']) {
    const candidate = value[key]
    if (typeof candidate === 'string') return candidate
    if (typeof candidate?.text === 'string') return candidate.text
    if (typeof candidate?.message?.text === 'string') return candidate.message.text
  }

  for (const child of Object.values(value)) {
    const found = findFacebookDescription(child, depth + 1)
    if (found !== null) return found
  }
  return null
}

export function extractFacebookListingForEdit(result: any): any {
  let root = result
  while (root?.data && typeof root.data === 'object') root = root.data
  const page = root?.viewer?.marketplace_product_details_page
  if (!page) throw new Error('Facebook no devolvió los datos de la publicación.')

  const target = page.target ?? page.marketplace_listing_renderable_target ?? {}
  const listingPrice = page.listing_price ?? target.listing_price ?? {}
  const location = target.location ?? page.location ?? {}
  const description = findFacebookDescription(page)
  if (description === null) {
    throw new Error('Facebook no devolvió la descripción de la publicación.')
  }
  
  return {
    id: target.id ?? page.id,
    title:
      target.marketplace_listing_title ??
      target.base_marketplace_listing_title ??
      page.marketplace_listing_title ??
      '',
    description,
    price: listingPrice.amount != null ? Number(listingPrice.amount) : null,
    currency: listingPrice.currency ?? 'EUR',
    categoryId:
      target.marketplace_listing_category_id ??
      page.marketplace_listing_category_id ??
      null,
    location: {
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
    },
    deliveryTypes: page.delivery_types ?? target.delivery_types ?? ['IN_PERSON'],
    shippingOffered: page.is_shipping_offered ?? target.is_shipping_offered ?? false,
    attributeData: page.attribute_data ?? target.attribute_data ?? [],
  }
}

export function buildFacebookUpdateListingVariables(
  actorId: string,
  itemExternalId: string,
  fields: { title: string; description: string; price: number },
  item: any
) {
  if (!actorId) throw new Error('Facebook: falta el id de la cuenta autenticada.')
  if (!itemExternalId) throw new Error('Facebook: falta el id de la publicación.')

  const price = Number(fields.price)
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('Introduce un precio válido para la publicación de Facebook.')
  }

  return {
    input: {
      actor_id: actorId,
      client_mutation_id: String(Date.now()),
      data: {
        common: {
          description: { text: fields.description },
          item_price: {
            currency: item.currency ?? 'EUR',
            price: String(price),
          },
          source_type: 'product_details',
          surface: 'edit_composer',
          title: fields.title,
        },
      },
      listing_id: itemExternalId,
    },
  }
}

export function extractFacebookComposerContext(result: any): {
  marketplaceId: string
  currency: string
  location: { latitude: number; longitude: number }
} {
  const settings = result?.data?.viewer?.marketplace_settings
  const marketplace = settings?.current_marketplace
  const location = settings?.sell_location
  const marketplaceId = marketplace?.id
  const latitude = Number(location?.latitude)
  const longitude = Number(location?.longitude)

  if (!marketplaceId) {
    throw new Error('Facebook no devolvió el marketplace_id del composer.')
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Facebook no devolvió una ubicación de venta válida.')
  }

  return {
    marketplaceId: String(marketplaceId),
    currency: String(marketplace?.primary_currency ?? 'EUR'),
    location: { latitude, longitude },
  }
}

function findLegacyCategoryId(value: any, depth = 0): string | null {
  if (!value || typeof value !== 'object' || depth > 12) return null
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findLegacyCategoryId(item, depth + 1)
      if (found) return found
    }
    return null
  }

  const legacyCategory = value.legacy_category
  if (legacyCategory?.id != null && String(legacyCategory.id).trim()) {
    return String(legacyCategory.id)
  }
  if (value.legacy_category_id != null && String(value.legacy_category_id).trim()) {
    return String(value.legacy_category_id)
  }
  if (value.category_id != null && String(value.category_id).trim()) {
    return String(value.category_id)
  }

  for (const child of Object.values(value)) {
    const found = findLegacyCategoryId(child, depth + 1)
    if (found) return found
  }
  return null
}

export function extractFacebookRecommendedCategoryId(result: any): string | null {
  const root = result?.data ?? result
  const prediction =
    root?.use_sherlock_photo_prediction ??
    root?.sherlock_photo_prediction ??
    root

  const topCategories =
    prediction?.top_categories ?? findFirstKey(root, 'top_categories')
  const virtualTaxonomies =
    prediction?.virtual_taxonomies ?? findFirstKey(root, 'virtual_taxonomies')

  for (const candidates of [topCategories, virtualTaxonomies]) {
    const categoryId = findLegacyCategoryId(candidates)
    if (categoryId) return categoryId
  }
  return null
}

function findFirstKey(obj: any, key: string, depth = 0): any {
  if (!obj || typeof obj !== 'object' || depth > 6) return null
  if (obj[key] && typeof obj[key] === 'object') return obj[key]
  for (const value of Object.values(obj)) {
    const found = findFirstKey(value, key, depth + 1)
    if (found) return found
  }
  return null
}

export function resolveFacebookCategoryId(listing: any, recommendedId?: string | null): string {
  const explicitId = listing?.attributes?.facebookCategoryId
  if (explicitId != null && String(explicitId).trim()) return String(explicitId)
  if (recommendedId) return String(recommendedId)

  const key = `${listing?.gender ?? ''}:${listing?.item_type ?? ''}`
  const id = FB_CATEGORY_IDS[key] ?? FB_CATEGORY_IDS.default
  if (!id) {
    throw new Error(
      'Falta la categoría de Facebook Marketplace. Configura FB_CATEGORY_IDS_JSON o FB_CATEGORY_DEFAULT.'
    )
  }
  return id
}

export function mapFacebookCondition(condition: any): string {
  const value = String(condition ?? '').trim().toLowerCase()
  if (/como nuevo|like new|used_like_new|muy bueno|very good|excelente/.test(value)) {
    return 'used_like_new'
  }
  if (/nuevo|new/.test(value)) return 'new'
  if (/aceptable|fair|used_fair/.test(value)) return 'used_fair'
  if (/bueno|good|used_good/.test(value)) return 'used_good'
  throw new Error(`Condición no compatible con Facebook Marketplace: ${condition}`)
}

function toPrice(value: any): string {
  const number = Number(String(value ?? '0').replace(',', '.').replace(/[^\d.]/g, ''))
  return Number.isFinite(number) ? number.toFixed(2) : '0.00'
}

// Keep the create payload aligned with the captured Marketplace composer mutation.
export function buildFacebookCreateListingVariables(s: any) {
  const listing = s.originalPayload?.listing ?? {}
  const location = s.fbSellLocation ?? listing.attributes?.facebookLocation ?? FB_DEFAULT_LOCATION
  const attributes = listing.attributes ?? {}

  const attributeData: Record<string, any> = {
    condition: mapFacebookCondition(listing.condition),
  }
  if (attributes.brand && attributes.brand !== 'Sin marca') {
    attributeData.brand = attributes.brand
  }
  if (attributes.size) attributeData.size = attributes.size

  return {
    input: {
      actor_id: s.fbUserId,
      client_mutation_id: String(Date.now()),
      audience: {
        marketplace: { marketplace_id: s.fbMarketplaceId },
      },
      data: {
        client_application: null,
        common: {
          attribute_data_json: JSON.stringify(attributeData),
          category_id: resolveFacebookCategoryId(listing, s.fbRecommendedCategoryId),
          commerce_shipping_carrier: null,
          commerce_shipping_carriers: [],
          comparable_price: 'null',
          cost_per_additional_item: null,
          delivery_types: ['IN_PERSON', 'DOOR_DROPOFF'],
          description: { text: String(listing.description ?? '') },
          draft_type: null,
          hidden_from_friends_visibility: 'VISIBLE_TO_EVERYONE',
          is_personalization_required: null,
          is_photo_order_set_by_seller: false,
          is_preview: false,
          item_price: {
            currency: s.fbCurrency ?? 'EUR',
            price: toPrice(listing.price),
          },
          latitude: location.latitude,
          listing_email_id: null,
          longitude: location.longitude,
          min_acceptable_checkout_offer_price: 'null',
          personalization_info: null,
          product_hashtag_names: [],
          quantity: null,
          shipping_calculation_logic_version: null,
          shipping_cost_option: 'BUYER_PAID_SHIPPING',
          shipping_cost_range_lower_cost: null,
          shipping_cost_range_upper_cost: null,
          shipping_label_price: '0',
          shipping_label_rate_code: null,
          shipping_label_rate_type: null,
          shipping_offered: false,
          shipping_options_data: [],
          shipping_package_weight: null,
          shipping_price: 'null',
          shipping_service_type: null,
          sku: listing.sku ?? '',
          source_type: 'composer_listing_type_selector',
          suggested_hashtag_names: [],
          surface: 'composer',
          title: String(listing.title ?? ''),
          variants: [],
          video_ids: [],
          xpost_target_ids: [],
          comments_disabled: false,
          photo_ids: s.fbPhotoIds ?? [],
        },
      },
      vin_autofill_summary: null,
    },
  }
}
