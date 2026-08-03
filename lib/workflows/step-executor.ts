/*
  Ejecutor de los workflows de extension, va acumulando los datos de pasos anteriores para
  poder pasarselos al resto de pasos del workflow.
  Funciones auxiliares de parseo de respuestas de los endpoints de config de Vinted y Wallapop.
*/

import type { WorkflowStep, WorkflowState } from './types'
import { buildVestiaireFieldSteps } from './vestiaire/vestiaire-field-mapper'

export function processStepResult(
  steps: WorkflowStep[],
  currentStep: number,
  result: any,
  state: WorkflowState
): { nextStep: WorkflowStep | null; updatedState: WorkflowState; nextIndex: number } {

  const completed = steps[currentStep]
  let s = { ...state }

  console.log('processStepResult — step completado:', completed.type, '| result:', JSON.stringify(result).substring(0, 200))

  // Acumulamos los datos en cada paso 
  switch (completed.type) {

    // VINTED
    case 'UPLOAD_PHOTO':
      s.photoIds = [...(s.photoIds ?? []), result.id]
      break

    case 'GET_CATEGORY_SUGGESTIONS':
      s.categoryId = result.categories?.[0]
      break

    case 'GET_PACKAGE_SUGGESTION':
      s.packageSizeId = result.package_size_id
      break

    case 'GET_ITEM_ATTRIBUTES': {
      s.itemAttributesRaw = result.attributes
      s.sizeId = findSizeId(result.attributes, s.originalPayload?.listing?.attributes?.size)
      s.statusId = findConditionId(result.attributes, s.originalPayload?.listing?.condition)
      break
    }

    case 'GET_BRAND': {
      const brand = result.brands?.[0]
      s.brandId = brand?.id ?? 1
      s.brandName = brand?.title ?? 'Publicar sin marca'
      break
    }
    case 'GET_COLORS':
      s.colorIds = getColorIds(result.colors, s.originalPayload?.listing?.colors)
      break

    case 'GET_USER_ID':
      s.userId = result.userId
      s.profileLink = result.profileLink
      s.accountName = result.accountName
      break

    case 'CHECK_ACCOUNT':
      s.syncStatus = result.matches ? 'OK' : 'ACCOUNT_NOT_FOUND'
      break

    case 'GET_WARDROBE':
      s.items = result.items
      break

    case 'GET_VINT_ITEM':
      s.vintedItem = result.item
      break

    // WALLAPOP
    case 'GET_USER_TYPE':
      s.userType = result.type
      s.isCommercial = result.isCommercial
      break

    case 'GET_SUBSCRIPTIONS':
      s.subscriptions = result
      break

    case 'GET_WALLA_WARDROBE':
      s.items = result.data ?? [];
      break

    case 'GET_USER_ME':
      s.userId = result.id
      s.accountName = result.micro_name
      s.profileLink = result.url_share
      s.email = result.email
      s.uploadId = crypto.randomUUID()
      s.wallaLocation = {
        latitude: result.location.approximated_latitude,
        longitude: result.location.approximated_longitude,
        approximated: false
      }
      break

    case 'GET_WALLA_CATEGORIES': {
      const categoryResult = getWallapopCategoryIds(
        result.categories,
        {
          gender: s.originalPayload?.listing?.gender,
          itemType: s.originalPayload?.listing?.item_type,
          title: s.originalPayload?.listing?.title
        }
      )
      s.root_category_id = categoryResult.root_category_id
      s.category_leaf_id = categoryResult.category_leaf_id
      s.subcategoryIds = categoryResult.subcategoryIds
      break
    }

    case 'GET_WALLA_COMPONENTS':
      s.wallaSizeId = getWallaSizeId(
        result.components,
        s.originalPayload?.listing?.attributes?.size
      )
      break

    case 'GET_WALLA_WEIGHT_TIERS': {
      const suggested = result.weight_tiers?.find((t: any) => t.suggested)
      s.wallaMaxWeightKg = suggested?.max_weight_in_kg ?? 1
      break
    }
    case 'CREATE_WALLA_ITEM':
      s.wallaItemId = result.id
      break

    case 'UPLOAD_WALLA_PHOTO':
      break

    case 'GET_WALLA_ITEM':
      s.wallaItem = result
      break


    // Vestiaire Collective
    case 'GET_VEST_USER_ID':
      s.userId = result.userId
      s.profileLink = result.profileLink
      s.accountName = result.accountName
      s.vestiaireId = result.vestiaireId
      break

    case 'GET_VEST_BRANDS': {
      const brand = result.data?.find((b: any) =>
        b.name?.toLowerCase() === s.originalPayload?.listing?.attributes?.brand?.toLowerCase()
      )
      s.vestBrandId = brand?.id ?? null
      s.vestBrandName = brand?.name ?? s.originalPayload?.listing?.attributes?.brand ?? ''
      break
    }

    case 'GET_VEST_CATALOG': {
      const { universeId, categoryId, subcategoryId } = resolveVestiaireCategory(
        result.data,
        {
          gender: s.originalPayload?.listing?.gender,
          itemType: s.originalPayload?.listing?.item_type,
          title: s.originalPayload?.listing?.title
        }
      )
      s.vestUniverseId = universeId
      s.vestCategoryId = categoryId
      s.vestSubcategoryId = subcategoryId
      break
    }

    case 'ADD_VEST_PRODUCT':
      s.vestDraftId = result.data?.id ?? result.id
      break

    case 'GET_VEST_FORM_OPTIONS':
      s.vestFormOptions = result.formOptions
      steps.splice(currentStep + 1, 0, ...buildVestiaireFieldSteps(s))
      break

    case 'UPLOAD_VEST_PHOTO':
      s.vestPhotoIds = [...(s.vestPhotoIds ?? []), result.data?.photos?.[0]?.id]
      break
    case 'GET_VEST_ADDRESSES': {
      // Preferimos la marcada como shipping
      const addresses: any[] = result.data ?? []
      const shipping = addresses.find(a => a.address?.flagList?.some((f: any) => f.name === 'shipping'))
      const selected = shipping ?? addresses[0]
      s.vestAddressId = selected?.address?.addressId ?? null
      break
    }

    case 'SET_VEST_SHIPPING_ADDRESS':
      break

    case 'GET_VEST_DRAFT_DETAILS':
      break

    case 'SUBMIT_VEST_PRODUCT':
      s.vestProductId = result.data?.id
      s.vestPublicationUrl = `https://es.vestiairecollective.com/proponer-un-articulo.shtml?id=${result.data?.reference}`
      break

    // Depop
    case 'GET_DEPOP_USER_ID':
      s.userId = result.userId
      s.username = result.username
      s.profileLink = result.profileLink
      break

    // Depop
    case 'GET_DEPOP_WARDROBE':
      s.items = [...(s.items ?? []), ...(result.products ?? [])]
      s.depopLastOffsetId = result.meta?.last_offset_id ?? null
      s.depopHasMore = result.meta?.end === false

      if (s.depopHasMore) {
        steps.splice(currentStep + 1, 0, {
          id: crypto.randomUUID(),
          type: 'GET_DEPOP_WARDROBE',
          platform: 'depop',
          request: { url: '', method: 'GET' }
        })
      }
      break

    case 'GET_DEPOP_SELLER_STATUS':
      s.depopCountryCode = result.user?.country ?? 'ES'
      break

    case 'GET_DEPOP_COUNTRIES': {
      const entry = (result as any[])?.find(c => c.countryCode === (s.depopCountryCode ?? 'ES'))
      s.depopGeoLat = entry?.geoLat ?? 40.4168
      s.depopGeoLng = entry?.geoLng ?? -3.7038
      break
    }

    case 'GET_DEPOP_CATEGORY_FILTERS':
      s.depopCategoryFilters = result
      break

    case 'GET_DEPOP_USER_SETTINGS':
      s.userId = result.id
      s.username = result.username
      s.depopCountryCode = result.country ?? s.depopCountryCode
      break

    case 'GET_DEPOP_PRODUCT_ATTRIBUTES': {
      s.depopConditionId = findDepopConditionId(
        result.condition,
        s.originalPayload?.listing?.condition
      )
      s.depopColourIds = findDepopColourIds(result.colour, s.originalPayload?.listing?.colors)
      s.depopBrandSlug = findDepopBrandSlug(result.brand, s.originalPayload?.listing?.attributes?.brand)
      break
    }

    case 'GET_DEPOP_BANNED_HASHTAGS':
      s.depopBannedHashtags = result.banned_hashtags
      break


    case 'UPLOAD_DEPOP_PHOTO':
      s.depopPictureIds = [...(s.depopPictureIds ?? []), result.id]
      break

    case 'PREDICT_DEPOP_CATEGORY': {
      const best = resolveDepopCategory(
        result.categories,
        {
          gender: s.originalPayload?.listing?.gender,
          itemType: s.originalPayload?.listing?.item_type
        }
      )
      s.depopDepartment = best.department
      s.depopGroup = best.group
      s.depopProductType = best.product_type
      s.depopGender = best.gender
      s.depopIsKids = best.is_kids
      break
    }

    case 'GET_DEPOP_SIZE_MAPPING':
      s.depopSizeMapping = result
      break

    case 'GET_DEPOP_SIZE_FILTERS': {
      const { variantSet, variantId } = resolveDepopSize(
        s.depopSizeMapping,
        result,
        {
          department: s.depopDepartment,
          group: s.depopGroup,
          productType: s.depopProductType,
          sizeTitle: s.originalPayload?.listing?.attributes?.size,
          region: 'IT'
        }
      )
      s.depopVariantSet = variantSet
      s.depopVariants = variantId ? { [variantId]: s.originalPayload?.listing?.stock ?? 1 } : { '1': 1 }
      break
    }

    case 'GET_DEPOP_PRICING_INSPIRATION':

      s.depopPricingInspiration = result.similar_sold_items
      break

    case 'SUBMIT_DEPOP_PRODUCT':
      s.depopProductId = result.id
      s.depopPublicationUrl = `https://www.depop.com/products/${result.slug}`
      break

    case 'GET_DEPOP_ITEM':
      s.depopItemRaw = result
      s.depopCountryCode = result.country ?? s.depopCountryCode ?? 'ES'
      break

    case 'UPDATE_DEPOP_ITEM':
      s.depopUpdateDone = true
      break

    case 'GET_ITEMS_NEW':
    case 'GET_CONFIGURATION':
    case 'GET_PROFILE':
    case 'DELETE_VINTED':
    case 'DELETE_WALLA':
    case 'FILL_VEST_FIELD':
    case 'FILL_VEST_FIELDS': {
      const fieldKey = Object.keys(completed.request?.body ?? {})[0]
      console.log('processStepResult — FILL_VEST_FIELD sent:', fieldKey, '=', completed.request?.body?.[fieldKey])
      break
    }
    case 'GET_VEST_PHOTOS':
    case 'DELETE_VEST_ITEM':
      break
  }

  const nextIndex = currentStep + 1
  if (nextIndex >= steps.length) {
    return { nextStep: null, updatedState: s, nextIndex }
  }

  // Clona el siguiente paso y rellena URLs/bodies 
  const next = JSON.parse(JSON.stringify(steps[nextIndex])) as WorkflowStep

  switch (next.type) {
    // Vinted
    case 'GET_PROFILE':
      next.request.url = `https://www.vinted.es/member/${s.userId}`
      break

    case 'GET_CATEGORY_SUGGESTIONS':
      next.request.url =
        `https://www.vinted.es/api/v2/item_upload/suggestions/categories` +
        `?photo_ids=${s.photoIds[0]}&upload_session_id=${s.uploadSessionId}`
      break

    case 'GET_PACKAGE_SUGGESTION':
      next.request.body = {
        item: { catalog_id: s.categoryId },
        session_id: crypto.randomUUID()
      }
      break

    case 'UPDATE_VINTED_ITEM':
      next.request.body = buildVintedUpdateItemBody(s)
      break

    case 'GET_ITEM_ATTRIBUTES':
      next.request.method = 'POST'
      next.request.url = `https://www.vinted.es/api/v2/item_upload/attributes`
      next.request.body = {
        attributes: [
          { code: 'category', value: [s.categoryId] }
        ]
      }
      break

    case 'CREATE_ITEM':
      next.request.body = buildCreateItemBody(s)
      break

    // Wallapop
    case 'GET_WALLA_COMPONENTS':
      next.request.body = {
        fields: {
          category_leaf_id: s.category_leaf_id,
          root_category_id: s.root_category_id,
          summary: s.originalPayload?.listing?.title
        },
        mode: {
          action: 'upload',
          id: s.uploadId
        }
      }
      break

    case 'GET_WALLA_WEIGHT_TIERS': {
      const l = s.originalPayload.listing
      const [sub1, sub2] = s.subcategoryIds ?? []

      const cleanPrice = normalizePrice(l.price)

      next.request.url =
        `https://api.wallapop.com/api/v3/delivery/weight/tiers/with-suggestion` +
        `?title=${encodeURIComponent(l.title)}` +
        `&amount=${cleanPrice}` +
        `&currency=EUR` +
        `&categoryId=${s.root_category_id}` +
        (sub1 ? `&subcategoryId=${sub1}` : '') +
        (sub2 ? `&subcategoryId2=${sub2}` : '')
      break
    }

    case 'CREATE_WALLA_ITEM':
      next.request.body = buildCreateWallaItemBody(s)
      break

    case 'UPLOAD_WALLA_PHOTO':
      next.request.url = `https://api.wallapop.com/api/v3/items/${s.wallaItemId}/picture2`
      break

    case 'GET_WALLA_ITEM':
      next.request.url = `https://api.wallapop.com/api/v3/items/${s.wallaItemId}`
      break

    case 'UPDATE_WALLA_ITEM':
      next.request.body = buildUpdateWallaItemBody(s)
      break

    // Vestiaire Collective
    case 'ADD_VEST_PRODUCT':
      next.request.body = {
        universe: String(s.vestUniverseId),
        brand: String(s.vestBrandId),
        macroModelId: '',
        modelVariationId: '',
        page: String(s.vestSubcategoryId)
      }
      break

    case 'GET_VEST_FORM_OPTIONS':
      next.request.url = `https://es.vestiairecollective.com/proponer-un-articulo.shtml?id=${s.vestDraftId}`
      break

    case 'FILL_VEST_FIELD':
    case 'FILL_VEST_FIELDS':
      next.request.url = `https://apiv2.vestiairecollective.com/product-listing/product-drafts/${s.vestDraftId}`
      break

    case 'UPLOAD_VEST_PHOTO':
      next.request.body = { productDraftId: s.vestDraftId }
      break

    case 'GET_VEST_PHOTOS':
      next.request.url = `https://apiv2.vestiairecollective.com/deposit/photos/products/drafts/${s.vestDraftId}`
      break

    case 'SET_VEST_SHIPPING_ADDRESS':
      next.request.url = `https://apiv2.vestiairecollective.com/users/me/addresses/${s.vestAddressId}/flags`
      break

    case 'GET_VEST_DRAFT_DETAILS':
      next.request.url = `https://apiv2.vestiairecollective.com/product-listing/product-drafts/${s.vestDraftId}/details`
      break


    case 'SUBMIT_VEST_PRODUCT':
      next.request.url = `https://apiv2.vestiairecollective.com/deposit/products/drafts/${s.vestDraftId}/submit`
      next.request.method = 'PUT'
      next.request.isFormData = true
      next.request.body = { withAddressV2: '1' }
      break

    // Depop
    case 'GET_DEPOP_WARDROBE':
      next.request.url =
        `https://webapi.depop.com/api/v3/shop/${s.userId}/products/` +
        `?limit=24&offset_id=${encodeURIComponent(s.depopLastOffsetId)}`
      break

    case 'PREDICT_DEPOP_CATEGORY':
      next.request.body = {
        description: `${s.originalPayload?.listing?.title ?? ''} ${s.originalPayload?.listing?.description ?? ''}`.trim(),
        user_id: s.userId,
        listing_lifecycle_id: s.listingLifecycleId
      }
      break


    case 'GET_DEPOP_PRICING_INSPIRATION': {
      const l = s.originalPayload.listing
      next.request.body = {
        brand: s.depopBrandSlug,
        colour: s.depopColourIds,
        condition: s.depopConditionId,
        country: s.depopCountryCode ?? 'ES',
        currency: 'EUR',
        description: l.description,
        gender: s.depopGender,
        is_kids: s.depopIsKids ?? false,
        product_type: s.depopProductType,
        source: l.attributes?.source ?? ['preloved']
      }
      break
    }

    case 'SUBMIT_DEPOP_PRODUCT': {
      const l = s.originalPayload.listing
      next.request.body = {
        age: l.attributes?.age ?? [],
        address: countryToAddressName(s.depopCountryCode),
        attributes: l.attributes?.extra ?? {},
        brand: s.depopBrandSlug,
        colour: s.depopColourIds,
        condition: s.depopConditionId,
        country: s.depopCountryCode ?? 'ES',
        description: l.description,
        gender: s.depopGender,
        geo_position_lat: s.depopGeoLat,
        geo_position_lng: s.depopGeoLng,
        is_kids: s.depopIsKids ?? false,
        listing_lifecycle_id: s.listingLifecycleId,
        national_shipping_cost: String(l.attributes?.shipping_cost ?? '0'),
        picture_ids: s.depopPictureIds ?? [],
        price_amount: String(l.price),
        price_currency: 'EUR',
        product_type: s.depopProductType,
        shipping_methods: [],
        source: l.attributes?.source ?? ['preloved'],
        style: l.attributes?.style ?? [],
        variant_set: s.depopVariantSet,
        variants: s.depopVariants,
        persistent_id: s.persistentId,
        quantity: l.stock ?? null
      }
      break
    }

    case 'UPDATE_DEPOP_ITEM':
      next.request.body = buildDepopUpdateItemBody(s)
      break
  }

  return { nextStep: next, updatedState: s, nextIndex }
}

// Busca el id de la talla dentro de la respuesta de /api/v2/item_upload/attributes.
// La respuesta trae varios "grupos" de tallas (S/M/L, EU, UK, FR, IT, US...) para
// la misma categoría; priorizamos el grupo "S/M/L" por ser el formato estándar
// que normalmente usa el catálogo interno de la app.
function findSizeId(attributes: any[], sizeTitle: string): number {

  const sizeAttr = attributes?.find((a: any) => a.code === 'size')
  const groups = sizeAttr?.configuration?.options ?? []

  const normalize = (s: string) => s?.toString().trim().toLowerCase()
  const target = normalize(sizeTitle)

  const letterGroup = groups.find((g: any) => g.title === 'S/M/L')
  const orderedGroups = letterGroup
    ? [letterGroup, ...groups.filter((g: any) => g !== letterGroup)]
    : groups

  for (const group of orderedGroups) {
    const match = group.options?.find((o: any) => normalize(o.title) === target)
    if (match) return match.id
  }

  return 123
}

// Busca el id de la condición dentro de la misma respuesta de /api/v2/item_upload/attributes.
function findConditionId(attributes: any[], condition: string): number {
  const condAttr = attributes?.find((a: any) => a.code === 'condition')
  const options = condAttr?.configuration?.options?.[0]?.options ?? []

  const normalize = (s: string) =>
    s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  const target = normalize(condition)

  const match = options.find((o: any) => normalize(o.title) === target)
  if (match) return match.id

  return 3
}

function getColorIds(colors: any[], titles: string[]): number[] {
  return (titles ?? [])
    .map(t => colors?.find(c => c.title.toLowerCase() === t.toLowerCase())?.id)
    .filter(Boolean)
}

function buildCreateItemBody(s: WorkflowState) {
  const l = s.originalPayload.listing
  return {
    feedback_id: null,
    item: {
      assigned_photos: s.photoIds.map(id => ({ id, orientation: 0 })),
      ai_photo: false,
      brand: s.brandName,
      brand_id: s.brandId,
      catalog_id: s.categoryId,
      color_ids: s.colorIds,
      currency: 'EUR',
      description: l.description,
      id: null,
      is_unisex: false,
      isbn: null,
      item_attributes: buildItemAttributes(s),
      manufacturer: null,
      manufacturer_labelling: null,
      measurement_length: null,
      measurement_width: null,
      package_size_id: s.packageSizeId,
      price: l.price,
      shipment_prices: { domestic: null, international: null },
      temp_uuid: s.uploadSessionId,
      title: l.title,
      video_game_rating_id: null
    },
    parcel: null,
    push_up: false,
    upload_session_id: s.uploadSessionId
  }
}

// Si no se pudo resolver talla o condición, cortamos aquí con un error explícito
// en vez de dejar que Vinted devuelva un 400 genérico de "rellena el campo".
function buildItemAttributes(s: WorkflowState) {
  if (!s.sizeId) {
    throw new Error(`No se pudo resolver la talla "${s.originalPayload?.listing?.attributes?.size}" para catalog_id ${s.categoryId}`)
  }
  if (!s.statusId) {
    throw new Error(`No se pudo resolver la condición "${s.originalPayload?.listing?.condition}" para catalog_id ${s.categoryId}`)
  }

  return [
    { code: 'size', ids: [s.sizeId] },
    { code: 'condition', ids: [s.statusId] }
  ]
}

const GENDER_FALLBACKS: Record<string, { category_leaf_id: string; subcategoryIds: string[] }> = {
  hombre: { category_leaf_id: '11043', subcategoryIds: ['11003', '11031'] }, // Otras prendas > Ropa > Hombre
  mujer: { category_leaf_id: '11020', subcategoryIds: ['11002', '11004'] }, // Otras prendas > Ropa > Mujer
  unisex: { category_leaf_id: '11043', subcategoryIds: ['11003', '11031'] }, // default hombre
}

const ROOT_ID = '12465'

const itemTypeMap: Record<string, string[]> = {
  'camiseta': ['camisetas', 'tops y camisetas'],
  'camisa': ['camisas'],
  'pantalon': ['pantalones', 'vaqueros y pantalones'],
  'vaquero': ['vaqueros y pantalones'],
  'sudadera': ['sudaderas'],
  'chaqueta': ['chaquetas', 'chaquetas y abrigos'],
  'abrigo': ['abrigos', 'chaquetas y abrigos'],
  'vestido': ['vestidos'],
  'falda': ['faldas'],
  'shorts': ['shorts', 'bermudas'],
  'bermuda': ['shorts', 'bermudas'],
  'zapatillas': ['zapatillas'],
  'zapatos': ['zapatos'],
  'bolso': ['bolsos'],
  'accesorio': ['accesorios'],
}

const genderKeywords: Record<string, string[]> = {
  hombre: ['hombre', 'chico', 'masculino'],
  mujer: ['mujer', 'chica', 'femenino'],
}

function getWallapopCategoryIds(
  categories: any[],
  params: { gender?: string; itemType?: string; title?: string }
): { root_category_id: string; category_leaf_id: string; subcategoryIds: string[] } {

  const normalize = (s: string) =>
    s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

  const gender = params.gender ?? 'hombre'
  const fallback = GENDER_FALLBACKS[gender] ?? GENDER_FALLBACKS['hombre']
  const defaultResult = { root_category_id: ROOT_ID, ...fallback }

  // Resuelve los nombres de nodo hoja candidatos desde itemType y/o titulo
  function resolveTargetNames(): string[] {
    const candidates = new Set<string>()
    const sources = [params.itemType, params.title].filter(Boolean) as string[]

    for (const source of sources) {
      const normSource = normalize(source)
      for (const [key, values] of Object.entries(itemTypeMap)) {
        if (normSource.includes(key)) {
          values.forEach(v => candidates.add(normalize(v)))
        }
      }
    }

    return Array.from(candidates)
  }

  // Poda nodos del genero opuesto
  function isOppositeGender(nodeName: string): boolean {
    if (!gender || gender === 'unisex') return false
    const oppositeKeywords = gender === 'hombre' ? genderKeywords['mujer'] : genderKeywords['hombre']
    return oppositeKeywords.some(kw => nodeName.includes(kw))
  }

  // Busqueda recursiva del nodo hoja que matchea
  function findLeaf(
    nodes: any[],
    rootId: string,
    path: string[]
  ): { root_category_id: string; category_leaf_id: string; subcategoryIds: string[] } | null {
    for (const node of nodes) {
      const nodeName = normalize(node.name ?? '')

      if (isOppositeGender(nodeName)) continue

      if (!node.subcategories?.length) {
        const targetNames = resolveTargetNames()
        if (targetNames.some(t => nodeName === t || nodeName.includes(t) || t.includes(nodeName))) {
          return {
            root_category_id: rootId,
            category_leaf_id: String(node.id),
            subcategoryIds: path,
          }
        }
        continue
      }

      const result = findLeaf(node.subcategories, rootId, [...path, String(node.id)])
      if (result) return result
    }
    return null
  }

  const targetNames = resolveTargetNames()
  if (!targetNames.length) return defaultResult

  const modaRoot = categories.find(c => String(c.id) === ROOT_ID)
  if (!modaRoot) return defaultResult

  return findLeaf(modaRoot.subcategories ?? [], ROOT_ID, []) ?? defaultResult
}

// Buscamos el size que coincida
function getWallaSizeId(components: any[], sizeTitle: string): string {
  const sizeComponent = components?.find((c: any) => c.id === 'size')
  const options = sizeComponent?.data?.source?.options ?? []

  const normalize = (s: string) => s?.toLowerCase().trim()
  const normTarget = normalize(sizeTitle)

  const match = options.find((opt: any) =>
    opt.title.split('/').map((p: string) => normalize(p)).includes(normTarget)
  )

  return match?.id ?? '32'
}

// JSON en un FormData
function buildCreateWallaItemBody(s: WorkflowState) {
  const l = s.originalPayload.listing

  const conditionMap: Record<string, string> = {
    'Sin estrenar': 'un_worn',
    'Nuevo': 'new',
    'Como nuevo': 'as_good_as_new',
    'Bueno': 'good',
    'Aceptable': 'fair',
    'Muy usado': 'has_given_it_all'
  }

  const colorMap: Record<string, string> = {
    'negro': 'black', 'marrón': 'brown', 'beige': 'beige', 'gris': 'gray',
    'blanco': 'white', 'azul': 'blue', 'verde azulado': 'teal',
    'turquesa': 'turquoise', 'verde': 'green', 'verde oliva': 'olive_green',
    'amarillo': 'yellow', 'naranja': 'orange', 'rojo': 'red',
    'rosa': 'pink', 'morado': 'purple', 'dorado': 'gold',
    'plateado': 'silver', 'multicolor': 'multicolor'
  }

  const color = colorMap[l.colors?.[0]?.toLowerCase()] ?? 'other'

  return {
    attributes: {
      brand: l.attributes.brand ?? 'Sin marca',
      size: s.wallaSizeId,
      color,
      title: l.title,
      description: l.description,
      condition: conditionMap[l.condition] ?? 'good',
      suggested_data_banner: null
    },
    category_leaf_id: s.category_leaf_id,
    price: {
      cash_amount: l.price,
      currency: 'EUR',
      apply_discount: false
    },
    location: s.wallaLocation,
    delivery: {
      allowed_by_user: false,
      max_weight_kg: null,
      cost_configuration_id: null
    }
  }
}

function normalizePrice(priceValue: string | number): string {
  if (priceValue === undefined || priceValue === null || priceValue === '') {
    return '0';
  }

  // Convertir a string si es num
  let price = String(priceValue);

  // Reemplazar coma por punto
  price = price.replace(',', '.');

  // Quedarse con el primer punto
  const parts = price.split('.');
  if (parts.length > 2) {
    price = parts[0] + '.' + parts.slice(1).join('');
  }

  price = price.replace(/[^0-9.]/g, '');

  // Si esta vacio devolver 0
  if (price === '' || price === '.') {
    return '0';
  }

  const num = parseFloat(price);
  if (isNaN(num) || num < 0) {
    return '0';
  }

  return num.toFixed(2);
}

function buildVintedUpdateItemBody(s: WorkflowState) {
  const item = s.vintedItem
  const fields = s.originalPayload?.fields ?? {}

  return {
    item: {
      ...item,
      title: fields.title ?? item.title,
      description: fields.description ?? item.description,
      price: fields.price != null ? fields.price : item.price?.amount,
      color_ids: item.color1_id ? [item.color1_id, item.color2_id].filter(Boolean) : []
    },
    feedback_id: null,
    parcel: null,
    push_up: false,
    upload_session_id: null
  }
}

function buildUpdateWallaItemBody(s: WorkflowState) {
  const item = s.wallaItem
  const fields = s.originalPayload?.fields ?? {}

  const price = fields.price != null
    ? normalizePriceNumber(fields.price)
    : Number(item.price?.cash?.amount)

  return {
    attributes: {
      title: fields.title ?? item.title?.original,
      description: fields.description ?? item.description?.original,
      brand: item.type_attributes?.brand?.value,
      size: item.type_attributes?.size?.value,
      color: item.type_attributes?.color?.value,
      condition: item.type_attributes?.condition?.value,
      price_amount: price,
      price_suggestion_data_banner: null
    },
    category_leaf_id: item.taxonomy?.[item.taxonomy.length - 1]?.id,
    apply_discount: false,
    location: {
      latitude: item.location?.latitude,
      longitude: item.location?.longitude,
      approximated: item.location?.approximated
    },
    delivery: {
      allowed_by_user: item.shipping?.user_allows_shipping ?? false,
      max_weight_kg: item.type_attributes?.up_to_kg?.value
        ? Number(item.type_attributes.up_to_kg.value)
        : 1,
      cost_configuration_id: null
    },
    pictures: (item.images ?? []).map((img: any, index: number) => ({
      id: img.id,
      order: index
    }))
  }
}

function normalizePriceNumber(value: number | string): number {
  const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value
  if (Number.isNaN(num) || num < 0) return 0
  return Number(num.toFixed(2))
}

function resolveVestiaireCategory(
  catalog: any[],
  params: { gender?: string; itemType?: string; title?: string }
): { universeId: string; categoryId: string; subcategoryId: string } {

  const normalize = (s: string) =>
    s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() ?? ''

  // Heurística de universo por género
  const genderUniverseMap: Record<string, string> = {
    mujer: '1',
    hombre: '2',
    niña: '3',
    niño: '4',
  }
  const gender = params.gender?.toLowerCase() ?? 'hombre'
  const universeId = genderUniverseMap[gender] ?? '2'

  const universe = catalog.find((u: any) => String(u.id) === universeId)
  if (!universe) return { universeId, categoryId: '12', subcategoryId: '525' }

  const normItemType = normalize(params.itemType ?? '')
  const normTitle = normalize(params.title ?? '')

  const bagKeywords = ['bolso', 'bolsos', 'bag', 'handbag', 'mochila', 'clutch', 'bandolera']
  const isBag = bagKeywords.some(kw => normItemType.includes(kw) || normTitle.includes(kw))

  if (isBag) {
    for (const category of universe.categories ?? []) {
      const normCat = normalize(category.title)
      if (!normCat.includes('bolso') && !normCat.includes('bag') && !normCat.includes('accesor')) continue

      for (const sub of category.subCategories ?? []) {
        const normSub = normalize(sub.title)
        if (bagKeywords.some(kw => normSub.includes(kw)) || normSub.includes('bolso')) {
          return {
            universeId,
            categoryId: String(category.id),
            subcategoryId: String(sub.id),
          }
        }
      }

      const firstSub = category.subCategories?.[0]
      if (firstSub) {
        return {
          universeId,
          categoryId: String(category.id),
          subcategoryId: String(firstSub.id),
        }
      }
    }
  }

  // Buscar subcategoría que matchee itemType o título
  for (const category of universe.categories ?? []) {
    for (const sub of category.subCategories ?? []) {
      const normSub = normalize(sub.title)
      if (
        normItemType && (normSub.includes(normItemType) || normItemType.includes(normSub)) ||
        normTitle && normSub.split(/[\s,]+/).some((word: string) => normTitle.includes(word) && word.length > 3)
      ) {
        return {
          universeId,
          categoryId: String(category.id),
          subcategoryId: String(sub.id)
        }
      }
    }
  }

  // Fallback: primera categoría Ropa + primera subcategoría
  const ropaCategory = universe.categories?.find((c: any) =>
    normalize(c.title).includes('ropa')
  )
  const fallbackSub = ropaCategory?.subCategories?.[0]
  return {
    universeId,
    categoryId: String(ropaCategory?.id ?? universe.categories?.[0]?.id ?? '12'),
    subcategoryId: String(fallbackSub?.id ?? '525'),
  }
}

function mapDepopCondition(condition: string): string {
  const map: Record<string, string> = {
    'Nuevo con etiquetas': 'brand_new',
    'Nuevo sin etiquetas': 'brand_new',
    'Muy bueno': 'used_like_new',
    'Bueno': 'used_good',
    'Satisfactorio': 'used_fair'
  }
  return map[condition] ?? 'used_good'
}

const DEPOP_CONDITION_FALLBACK: Record<string, string> = {
  'sin estrenar': 'brand_new',
  'nuevo': 'brand_new',
  'como nuevo': 'used_like_new',
  'bueno': 'used_excellent',
  'aceptable': 'used_good',
  'muy usado': 'used_fair',
}

function findDepopConditionId(options: any[], condition: string): string {
  const normalize = (s: string) =>
    s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  const target = normalize(condition)

  const direct = options?.find((o: any) => normalize(o.nameI18N) === target)
  if (direct) return direct.id

  return DEPOP_CONDITION_FALLBACK[target] ?? 'used_good'
}


function findDepopColourIds(options: any[], colors: string[]): string[] {
  const normalize = (s: string) => s?.toLowerCase().trim()
  const COLOR_ES_EN: Record<string, string> = {
    negro: 'black', gris: 'grey', blanco: 'white', marrón: 'brown',
    marron: 'brown', beige: 'tan', azul: 'blue', verde: 'green',
    amarillo: 'yellow', naranja: 'orange', rojo: 'red', rosa: 'pink',
    morado: 'purple', dorado: 'gold', plateado: 'silver', crema: 'cream',
    multicolor: 'multi',
  }

  return (colors ?? [])
    .map(c => {
      const norm = normalize(c)
      const enGuess = COLOR_ES_EN[norm] ?? norm
      return options?.find((o: any) => normalize(o.nameI18N) === enGuess || normalize(o.id) === enGuess)?.id
    })
    .filter(Boolean)
}


function findDepopBrandSlug(brands: any[], brandName: string): string {
  if (!brandName) return ''
  const normalize = (s: string) => s?.toLowerCase().trim()
  const target = normalize(brandName)

  const match = brands?.find((b: any) => normalize(b.name) === target)
  if (match) return match.id

  return target
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}


function resolveDepopCategory(
  categories: any[],
  params: { gender?: string | null; itemType?: string | null }
) {
  const genderMap: Record<string, string> = { hombre: 'male', mujer: 'female' }
  const targetGender = params.gender ? genderMap[params.gender] : null

  if (targetGender) {
    const match = categories?.find((c: any) => c.gender === targetGender)
    if (match) return match
  }

  return categories?.[0] ?? {
    department: 'menswear', group: 'tops', product_type: 'other-tops',
    gender: 'male', is_kids: false
  }
}


function resolveDepopSize(
  sizeMapping: any,
  sizeFilters: any[],
  params: { department?: string; group?: string; productType?: string; sizeTitle?: string; region?: string }
): { variantSet: number | null; variantId: string | null } {

  const mapping = sizeMapping?.category_size_mapping?.find((m: any) =>
    m.department === params.department &&
    m.group === params.group &&
    m.product_type === params.productType
  )

  const variantSet = mapping?.size_set_by_region?.[params.region ?? 'EUR'] ?? null
  if (!variantSet) return { variantSet: null, variantId: null }

  const normalize = (s: string) => s?.toLowerCase().trim()
  const target = normalize(params.sizeTitle ?? '')

  const deptNode = sizeFilters?.find((d: any) => d.id === params.department)
  for (const sizeType of deptNode?.children ?? []) {
    for (const regionNode of sizeType.children ?? []) {
      if (regionNode.id !== variantSet) continue
      const match = regionNode.children?.find((sz: any) => normalize(sz.name) === target)
      if (match) return { variantSet, variantId: String(match.id) }
    }
  }

  return { variantSet, variantId: '1' }
}

function countryToAddressName(countryCode: string): string {
  const map: Record<string, string> = { ES: 'Spain', IT: 'Italy', FR: 'France', PT: 'Portugal' }
  return map[countryCode] ?? 'Spain'
}

function buildDepopUpdateItemBody(s: WorkflowState) {
  const item = s.depopItemRaw
  const fields = s.originalPayload?.fields ?? {}

  return {
    age: item.age ?? [],
    address: item.location,
    attributes: item.attributes ?? {},
    brand: item.brand,
    colour: item.colour ?? [],
    condition: item.condition,
    country: item.country,
    description: fields.description ?? item.description,
    gender: item.gender,
    geo_position_lat: s.depopGeoLat,
    geo_position_lng: s.depopGeoLng,
    is_kids: item.is_kids ?? false,
    national_shipping_cost: item.national_shipping_cost,
    picture_ids: (item.pictures ?? []).map((p: any) => p.id),
    price_amount: fields.price != null ? String(fields.price) : item.pricing?.original_price?.total_price,
    price_currency: item.pricing?.currency ?? 'EUR',
    product_type: item.product_type,
    shipping_methods: item.shipping_methods ?? [],
    source: item.source ?? [],
    style: item.style ?? [],
    variant_set: item.variant_set_id,
    variants: item.variants ?? {},
  }
}