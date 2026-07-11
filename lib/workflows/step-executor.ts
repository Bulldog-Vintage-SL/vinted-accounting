/*
  Ejecutor de los workflows de extension, va acumulando los datos de pasos anteriores para
  poder pasarselos al resto de pasos del workflow.
  Funciones auxiliares de parseo de respuestas de los endpoints de config de Vinted y Wallapop.
*/

import type { WorkflowStep, WorkflowState } from './types'

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

    // Sustituye a los antiguos GET_SIZE_OPTIONS + GET_CONDITION_OPTIONS.
    // Este es el endpoint real que usa el frontend de Vinted
    // (POST /api/v2/item_upload/attributes con { code: 'category', value: [catalogId] }),
    // y devuelve talla + condición ya resueltas para la categoría exacta en una sola llamada.
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
    case 'GET_ITEMS_NEW':
    case 'GET_CONFIGURATION':
    case 'GET_PROFILE':
    case 'DELETE_VINTED':
    case 'DELETE_WALLA':
    case 'FILL_VEST_FIELDS':
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

    // Sustituye a los antiguos GET_SIZE_OPTIONS y GET_CONDITION_OPTIONS
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

    case 'FILL_VEST_FIELDS':
      next.request.url = `https://apiv2.vestiairecollective.com/product-listing/product-drafts/${s.vestDraftId}`
      next.request.body = buildVestiaireFieldsFormData(s)
      break

    case 'UPLOAD_VEST_PHOTO':
      next.request.body = { productDraftId: s.vestDraftId }
      break

    case 'GET_VEST_PHOTOS':
      next.request.url = `https://apiv2.vestiairecollective.com/deposit/photos/products/drafts/${s.vestDraftId}`
      break

    case 'FILL_VEST_DESCRIPTION':
      next.request.url = `https://apiv2.vestiairecollective.com/product-listing/product-drafts/${s.vestDraftId}`
      next.request.body = buildVestiaireDescriptionFormData(s)
      break

    case 'SET_VEST_SHIPPING_ADDRESS':
      next.request.url = `https://apiv2.vestiairecollective.com/users/me/addresses/${s.vestAddressId}/flags`
      break

    case 'GET_VEST_DRAFT_DETAILS':
      next.request.url = `https://apiv2.vestiairecollective.com/product-listing/product-drafts/${s.vestDraftId}/details`
      break


    case 'SUBMIT_VEST_PRODUCT':
      next.request.url = `https://apiv2.vestiairecollective.com/deposit/products/drafts/${s.vestDraftId}/submit`
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
    subcategoryId: String(fallbackSub?.id ?? '525')
  }
}

function buildVestiaireFieldsFormData(s: WorkflowState): Record<string, string> {
  const l = s.originalPayload.listing
  const opts = s.vestFormOptions

  // Helper: busca el id de un valor por displayName dentro de un mnemonic
  function resolveId(mnemonic: string, displayName: string): string | null {
    const section = opts?.informations?.find((info: any) => info.mnemonic === mnemonic)
    const field = section?.fields?.[0]
    const normalize = (s: string) => s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
    const match = field?.values?.find((v: any) => normalize(v.displayName) === normalize(displayName))
    return match ? String(match.id) : null
  }

  function resolveSizeIds(sizeStr: string): { size_unit: string; size: string } | null {
    const sizeSection = opts?.informations?.find((info: any) => info.mnemonic === 'size')
    const unitField = sizeSection?.fields?.find((f: any) => f.mnemonic === 'size_unit')
    const sizeField = sizeSection?.fields?.find((f: any) => f.mnemonic === 'size')

    // Usamos siempre International (primer size_unit)
    const unitId = unitField?.values?.[0]?.id
    if (!unitId) return null

    const normalize = (s: string) => s?.toLowerCase().trim()
    const match = sizeField?.values?.find((v: any) =>
      normalize(v.displayName) === normalize(sizeStr) &&
      v.dependsOn?.some((d: any) => d.field === 'size_unit' && d.values.includes(unitId))
    )

    return match ? { size_unit: String(unitId), size: String(match.id) } : null
  }

  const fields: Record<string, string> = {}

  const conditionMap: Record<string, string> = {
    'Nuevo': '9',
    'Como nuevo': '3',
    'Bueno': '4',
    'Aceptable': '5'
  }

  const conditionId = conditionMap[l.condition]
  if (conditionId) fields.preduct_condition = conditionId

  const color = resolveId('color', l.colors?.[0])
  if (color) fields.preduct_color = color

  const materialId = resolveId('material', l.attributes.material) ?? '2'
  fields.preduct_material = materialId

  // Pattern: por defecto "Ninguno"
  const pattern = resolveId('pattern', 'Ninguno')
  if (pattern) fields.preduct_pattern = pattern

  const sizeIds = resolveSizeIds(l.attributes?.size)
  if (sizeIds) {
    fields.preduct_size_unit = sizeIds.size_unit
    fields.preduct_size = sizeIds.size
  }

  // Currency EUR y precio siempre presentes
  const currencyField = opts?.price?.[0]?.fields?.find((f: any) => f.mnemonic === 'currency')
  const eur = currencyField?.values?.find((v: any) => v.code === 'EUR')
  fields.preduct_currency = eur ? String(eur.id) : '38'
  fields.preduct_pvp = String(l.price)
  fields.preduct_purchase_place = '4'

  return fields
}

function buildVestiaireDescriptionFormData(s: WorkflowState): Record<string, string> {
  const l = s.originalPayload.listing
  return {
    preduct_description: encodeURIComponent(l.description ?? ''),
  }
}