/*
  Maps listing fields + Vestiaire formOptions to individual preduct_* form entries.
  Vestiaire requires one field per HTTP POST to product-drafts/{draftId}.
*/

import type { WorkflowState, WorkflowStep } from '../types'

const DRAFT_URL = (draftId: string) =>
  `https://apiv2.vestiairecollective.com/product-listing/product-drafts/${draftId}`

const SPANISH_COLOR_TO_ENGLISH: Record<string, string> = {
  negro: 'black',
  blanco: 'white',
  gris: 'grey',
  'gris oscuro': 'dark grey',
  antracita: 'anthracite',
  marron: 'brown',
  beige: 'beige',
  azul: 'blue',
  rojo: 'red',
  verde: 'green',
  rosa: 'pink',
  morado: 'purple',
  naranja: 'orange',
  amarillo: 'yellow',
  dorado: 'gold',
  plateado: 'silver',
  multicolor: 'multicolour',
}

const SPANISH_CONDITION_HINTS: Record<string, string[]> = {
  nuevo: ['new', 'never worn', 'sin estrenar'],
  'sin estrenar': ['new', 'never worn'],
  'como nuevo': ['very good', 'excellent'],
  bueno: ['good condition', 'good'],
  aceptable: ['fair', 'satisfactory'],
}

// Keywords para resolver el campo "subcategory" cuando este representa un
// corte/tipo de prenda (pantalones, vaqueros...) en vez de un tipo de bolso.
// Se comparan contra item_type/title normalizados y contra displayName de
// las opciones del form (ej. "Slim", "Bootcut", "Recto", "Boyfriend"...).
const CUT_KEYWORD_HINTS: Record<string, string[]> = {
  slim: ['slim'],
  skinny: ['slim'],
  pitillo: ['slim'],
  recto: ['recto', 'straight'],
  straight: ['recto', 'straight'],
  bootcut: ['bootcut'],
  campana: ['bootcut', 'flare'],
  flare: ['bootcut', 'flare'],
  boyfriend: ['boyfriend'],
  ancho: ['boyfriend', 'wide'],
  wide: ['boyfriend', 'wide'],
  corto: ['corto', 'short'],
  short: ['corto', 'short'],
  largo: ['largo', 'long'],
}

function normalize(s: string | undefined | null): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function findInformationSection(opts: any, mnemonic: string) {
  return opts?.informations?.find((info: any) => info.mnemonic === mnemonic)
}

function findField(opts: any, mnemonic: string) {
  for (const section of opts?.informations ?? []) {
    if (section.mnemonic === mnemonic) {
      return section.fields?.[0] ?? section.fields?.find((f: any) => f.mnemonic === mnemonic)
    }
    const field = section.fields?.find((f: any) => f.mnemonic === mnemonic)
    if (field) return field
  }

  const priceField = opts?.price?.flatMap((p: any) => p.fields ?? []).find((f: any) => f.mnemonic === mnemonic)
  if (priceField) return priceField

  return null
}

function getAllFields(opts: any): any[] {
  const fromInformations = (opts?.informations ?? []).flatMap((section: any) => section.fields ?? [])
  const fromPrice = (opts?.price ?? []).flatMap((section: any) => section.fields ?? [])
  return [...fromInformations, ...fromPrice]
}

export function hasFormField(opts: any, mnemonic: string): boolean {
  return Boolean(findField(opts, mnemonic))
}

// Detecta si el listing es un bolso usando SOLO señales del propio producto
// (item_type/title/categoría ya resuelta). Antes también se consideraba bolso
// cualquier prenda cuyo formulario tuviera "subcategory" + "model" a la vez,
// pero esa combinación de campos también aparece en pantalones/vaqueros
// (subcategory = corte, model = modelo de la marca), lo que hacía que unos
// vaqueros se trataran como bolso: se saltaba la talla real y se rellenaban
// dimensiones de bolso en los campos de "anchura"/"largo" de la pernera.
export function isBagListing(listing: any, opts: any, state?: WorkflowState): boolean {
  const itemType = normalize(listing?.item_type)
  const title = normalize(listing?.title)

  if (
    itemType.includes('bolso') ||
    itemType.includes('bag') ||
    itemType.includes('mochila') ||
    itemType.includes('handbag') ||
    itemType.includes('bandolera') ||
    itemType.includes('clutch') ||
    title.includes('bolso') ||
    title.includes('handbag')
  ) {
    return true
  }

  // Ids de categoría "Bags" según el catálogo de Vestiaire:
  // "5" = Bags (Womenswear), "141" = Bags (Menswear)
  if (state?.vestCategoryId === '5' || state?.vestCategoryId === '141') {
    return true
  }

  return false
}

// Detecta si el listing es un pantalón/vaquero (para resolver bien "subcategory"
// como corte, y no como tipo de bolso).
function isTrouserListing(listing: any, state?: WorkflowState): boolean {
  const itemType = normalize(listing?.item_type)
  const title = normalize(listing?.title)

  if (
    itemType.includes('pantalon') ||
    itemType.includes('vaquero') ||
    itemType.includes('jean') ||
    title.includes('pantalon') ||
    title.includes('vaquero') ||
    title.includes('jean')
  ) {
    return true
  }

  // Ids de categoría "Trousers/Jeans" habituales en el catálogo de Vestiaire
  const trouserCategoryIds = ['18', '35', '23', '34']
  if (state?.vestCategoryId && trouserCategoryIds.includes(String(state.vestCategoryId))) {
    return true
  }

  return false
}

function resolveDisplayNameId(opts: any, mnemonic: string, displayName: string | undefined): string | null {
  if (!displayName) return null
  const field = findField(opts, mnemonic)
  const target = normalize(displayName)
  const match = field?.values?.find((v: any) => normalize(v.displayName) === target)
  return match ? String(match.id) : null
}

function resolveDisplayNameIdFuzzy(opts: any, mnemonic: string, displayName: string | undefined): string | null {
  if (!displayName) return null
  const field = findField(opts, mnemonic)
  const target = normalize(displayName)
  const match = field?.values?.find((v: any) => {
    const name = normalize(v.displayName)
    return name === target || name.includes(target) || target.includes(name)
  })
  return match ? String(match.id) : null
}

function resolveConditionId(opts: any, condition: string | undefined): string {
  const field = findField(opts, 'condition')
  const target = normalize(condition)

  if (field?.values?.length && target) {
    const direct = field.values.find((v: any) => normalize(v.displayName) === target)
    if (direct) return String(direct.id)

    const fuzzy = field.values.find((v: any) => {
      const name = normalize(v.displayName)
      return name.includes(target) || target.includes(name)
    })
    if (fuzzy) return String(fuzzy.id)

    const hints = SPANISH_CONDITION_HINTS[target] ?? []
    for (const hint of hints) {
      const hinted = field.values.find((v: any) => normalize(v.displayName).includes(hint))
      if (hinted) return String(hinted.id)
    }
  }

  const fallback: Record<string, string> = {
    nuevo: '9',
    'sin estrenar': '9',
    'como nuevo': '3',
    bueno: '4',
    aceptable: '5',
  }
  return fallback[target] ?? '4'
}

// Extrae, a partir del título/item_type del listing, qué keyword de corte de
// pantalón aplica (slim, recto, bootcut...), para poder matchearlo luego
// contra los displayName reales de las opciones del form.
function extractCutHints(listing: any): string[] {
  const haystack = normalize(`${listing?.title ?? ''} ${listing?.item_type ?? ''} ${listing?.description ?? ''}`)
  const hints: string[] = []

  for (const [keyword, mappedNames] of Object.entries(CUT_KEYWORD_HINTS)) {
    if (haystack.includes(keyword)) {
      hints.push(...mappedNames)
    }
  }

  return Array.from(new Set(hints))
}

function resolveSubcategoryId(opts: any, listing: any, state: WorkflowState | undefined, pageName?: string): string | null {
  const field = findField(opts, 'subcategory')
  const values: any[] = field?.values ?? []
  if (!values.length) return null

  const isBag = isBagListing(listing, opts, state)
  const isTrouser = isTrouserListing(listing, state)

  let candidates: string[] = []

  if (isTrouser) {
    // Para pantalones, "subcategory" es el corte (Slim/Recto/Bootcut/Boyfriend...)
    candidates = extractCutHints(listing)
  } else if (isBag) {
    candidates = [
      listing?.item_type,
      listing?.title,
      pageName,
      "women's handbag",
      'handbag',
      'handbags',
      'bolso',
    ].filter(Boolean) as string[]
  } else {
    candidates = [listing?.item_type, listing?.title, pageName].filter(Boolean) as string[]
  }

  for (const candidate of candidates) {
    const target = normalize(candidate)
    if (!target) continue
    const match = values.find((v: any) => {
      const name = normalize(v.displayName)
      return name === target || name.includes(target) || target.includes(name)
    })
    if (match) return String(match.id)
  }

  // Si no hay match, preferimos una opción "Otro(s)" explícita antes que
  // asumir a ciegas la primera opción de la lista.
  const other = values.find((v: any) => {
    const name = normalize(v.displayName)
    return name === 'otro' || name === 'otros' || name === 'other' || name === 'others'
  })
  if (other) return String(other.id)

  return String(values[0].id)
}

function resolveColorId(opts: any, colorName: string | undefined): string | null {
  if (!colorName) return null

  const direct =
    resolveDisplayNameId(opts, 'color', colorName) ??
    resolveDisplayNameIdFuzzy(opts, 'color', colorName)
  if (direct) return direct

  const english = SPANISH_COLOR_TO_ENGLISH[normalize(colorName)]
  if (english) {
    return (
      resolveDisplayNameId(opts, 'color', english) ??
      resolveDisplayNameIdFuzzy(opts, 'color', english)
    )
  }

  return null
}

function resolvePatternId(opts: any, patternName?: string): string | null {
  const candidates = [patternName, 'Ninguno', 'None', 'Plain', 'Sin estampado'].filter(Boolean) as string[]

  for (const candidate of candidates) {
    const id =
      resolveDisplayNameId(opts, 'pattern', candidate) ??
      resolveDisplayNameIdFuzzy(opts, 'pattern', candidate)
    if (id) return id
  }

  const field = findField(opts, 'pattern')
  const plain = field?.values?.find((v: any) => {
    const name = normalize(v.displayName)
    return name.includes('none') || name.includes('plain') || name.includes('ninguno')
  })
  return plain ? String(plain.id) : null
}

function resolveMaterialId(opts: any, listing: any): string {
  const fromListing =
    resolveDisplayNameIdFuzzy(opts, 'material', listing?.attributes?.material) ??
    resolveDisplayNameId(opts, 'material', listing?.attributes?.material)
  if (fromListing) return fromListing

  return '2'
}

function resolveSizeIds(opts: any, sizeStr: string | undefined): { size_unit: string; size: string } | null {
  if (!sizeStr) return null

  const sizeSection = findInformationSection(opts, 'size')
  const unitField = sizeSection?.fields?.find((f: any) => f.mnemonic === 'size_unit')
  const sizeField = sizeSection?.fields?.find((f: any) => f.mnemonic === 'size')
  if (!sizeField?.values?.length) return null

  const target = normalize(sizeStr)
  const isNumeric = /^\d+(\.\d+)?$/.test(target)
  const units: any[] = unitField?.values ?? [{ id: null }] // por si no hay size_unit (prendas sin unidades)

  // Probamos cada unidad en el orden en que las lista Vestiaire (para ES,
  // "FR" suele ir primero y es la que corresponde a la talla que guardamos,
  // pero no lo asumimos como garantía: iteramos todas y nos quedamos con
  // la primera que dé un match exacto).
  for (const unit of units) {
    const unitId = unit.id
    const candidates = sizeField.values.filter((v: any) => {
      if (unitId == null) return true
      return v.dependsOn?.some((d: any) => d.field === 'size_unit' && d.values.includes(unitId))
    })

    // Match exacto siempre primero (crítico para números: evita que "3"
    // matchee "34" por un includes() suelto)
    const exact = candidates.find((v: any) => normalize(v.displayName) === target)
    if (exact) return { size_unit: String(unitId ?? candidates[0]?.id ?? ''), size: String(exact.id) }

    // Para tallas no numéricas (S/M/L/XL...) sí permitimos fuzzy match,
    // porque el listing origen puede traer "extra large" en vez de "XL"
    if (!isNumeric) {
      const fuzzy = candidates.find((v: any) => {
        const name = normalize(v.displayName)
        return name.includes(target) || target.includes(name)
      })
      if (fuzzy) return { size_unit: String(unitId ?? candidates[0]?.id ?? ''), size: String(fuzzy.id) }
    }
  }

  console.warn(`[Vestiaire] No se pudo resolver talla "${sizeStr}" en ninguna unidad disponible`)
  return null
}

function resolveCurrencyId(opts: any): string {
  const currencyField = opts?.price?.[0]?.fields?.find((f: any) => f.mnemonic === 'currency')
  const eur = currencyField?.values?.find((v: any) => v.code === 'EUR')
  return eur ? String(eur.id) : '38'
}

function resolvePrice(listing: any): string {
  const raw = listing?.price
  if (raw === null || raw === undefined || raw === '') {
    throw new Error('El listing no tiene precio definido para Vestiaire')
  }
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'))
  if (Number.isNaN(num) || num <= 0) {
    throw new Error(`Precio inválido para Vestiaire: ${raw}`)
  }
  // Vestiaire only accepts integer prices (e.g. 49.95 → 49)
  return String(Math.floor(num))
}

function findDimensionFields(opts: any): Array<{ apiKey: string; mnemonic: string }> {
  return getAllFields(opts)
    .filter((field) => /^dimension_\d+$/.test(field.mnemonic ?? ''))
    .map((field) => ({
      apiKey: `preduct_${field.mnemonic}`,
      mnemonic: field.mnemonic,
    }))
}

export function buildVestiaireFieldEntries(s: WorkflowState): Array<{ key: string; value: string }> {
  const l = s.originalPayload?.listing
  const opts = s.vestFormOptions
  const entries: Array<{ key: string; value: string }> = []
  const isBag = isBagListing(l, opts, s)
  const pageName = s.vestFormOptions?.pageName ?? "women's Handbag"

  // "subcategory" se rellena siempre que el campo exista en el formulario,
  // sea bolso, pantalón o cualquier otra categoría que lo use — antes solo
  // se rellenaba dentro del bloque "isBag", así que en pantalones se perdía
  // (aunque required:true) salvo que isBagListing (mal) devolviera true.
  if (hasFormField(opts, 'subcategory')) {
    const subcategoryId = resolveSubcategoryId(opts, l, s, pageName)
    if (subcategoryId) entries.push({ key: 'preduct_subcategory', value: subcategoryId })
  }

  entries.push({ key: 'preduct_condition', value: resolveConditionId(opts, l?.condition) })

  entries.push({ key: 'preduct_pvp', value: resolvePrice(l) })
  entries.push({ key: 'preduct_currency', value: resolveCurrencyId(opts) })

  if (hasFormField(opts, 'model')) {
    entries.push({ key: 'preduct_model', value: '-1' })
  }

  entries.push({ key: 'preduct_material', value: resolveMaterialId(opts, l) })

  const colorId = resolveColorId(opts, l?.colors?.[0])
  if (colorId) entries.push({ key: 'preduct_color', value: colorId })

  const patternId = resolvePatternId(opts, l?.attributes?.pattern)
  if (patternId) entries.push({ key: 'preduct_pattern', value: patternId })

  // La talla es un campo real de la prenda, no exclusivo de "no bolso" por
  // definición — simplemente los bolsos no la tienen en el formulario. Al
  // comprobar hasFormField en vez de depender de isBag, esto también queda
  // protegido si algún día un bolso sí trajera talla.
  if (!isBag && hasFormField(opts, 'size')) {
    const sizeIds = resolveSizeIds(opts, l?.attributes?.size)
    if (sizeIds) {
      entries.push({ key: 'preduct_size_unit', value: sizeIds.size_unit })
      entries.push({ key: 'preduct_size', value: sizeIds.size })
    }
  }

  if (isBag) {
    const height = l?.attributes?.height ?? l?.attributes?.dimension_height ?? '20'
    const width = l?.attributes?.width ?? l?.attributes?.dimension_width ?? '15'
    const dimensionFields = findDimensionFields(opts)

    if (dimensionFields.length > 0) {
      for (const field of dimensionFields) {
        const value = field.mnemonic === 'dimension_31' ? String(height) : String(width)
        entries.push({ key: field.apiKey, value })
      }
    } else {
      entries.push({ key: 'preduct_dimension_31', value: String(height) })
      entries.push({ key: 'preduct_dimension_30', value: String(width) })
    }
  }

  entries.push({ key: 'preduct_description', value: l?.description ?? '' })

  if (hasFormField(opts, 'purchase_place')) {
    entries.push({ key: 'preduct_purchase_place', value: '4' })
  }

  return entries.filter(({ value }) => value !== '')
}

export function buildVestiaireFieldSteps(s: WorkflowState): WorkflowStep[] {
  const draftId = s.vestDraftId
  if (!draftId) return []

  const entries = buildVestiaireFieldEntries(s)
  console.log(
    '[Vestiaire] Field steps for draft',
    draftId,
    ':',
    entries.map((e) => `${e.key}=${e.value.substring(0, 40)}`).join(', ')
  )

  return entries.map(({ key, value }) => ({
    id: crypto.randomUUID(),
    platform: 'vestiaire',
    type: 'FILL_VEST_FIELD',
    request: {
      url: DRAFT_URL(draftId),
      method: 'POST',
      isFormData: true,
      body: { [key]: value },
    },
  }))
}