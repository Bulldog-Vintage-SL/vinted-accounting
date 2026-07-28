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

export function isBagListing(listing: any, opts: any, state?: WorkflowState): boolean {
  const itemType = normalize(listing?.item_type)
  const title = normalize(listing?.title)

  if (
    itemType.includes('bolso') ||
    itemType.includes('bag') ||
    itemType.includes('mochila') ||
    itemType.includes('handbag') ||
    title.includes('bolso') ||
    title.includes('handbag')
  ) {
    return true
  }

  if (state?.vestSubcategoryId === '59' || state?.vestCategoryId === '5') {
    return true
  }

  if (hasFormField(opts, 'subcategory') && hasFormField(opts, 'model')) {
    return true
  }

  return getAllFields(opts).some((field) => /^dimension_\d+$/.test(field.mnemonic ?? ''))
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

function resolveSubcategoryId(opts: any, listing: any, pageName?: string): string | null {
  const field = findField(opts, 'subcategory')
  const values: any[] = field?.values ?? []
  if (!values.length) return null

  const candidates = [
    listing?.item_type,
    listing?.title,
    pageName,
    "women's handbag",
    'handbag',
    'handbags',
    'bolso',
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    const target = normalize(candidate)
    const match = values.find((v: any) => {
      const name = normalize(v.displayName)
      return name === target || name.includes(target) || target.includes(name)
    })
    if (match) return String(match.id)
  }

  // Never use catalog page id (e.g. 59) — pick first formOptions value
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

  const field = findField(opts, 'material')
  const values: any[] = field?.values ?? []
  if (!values.length) return '2'

  const preferred = ['leather', 'cuero', 'other', 'otro', 'cotton', 'algodon']
  for (const keyword of preferred) {
    const match = values.find((v: any) => normalize(v.displayName).includes(keyword))
    if (match) return String(match.id)
  }

  return String(values[0].id)
}

function resolveSizeIds(opts: any, sizeStr: string | undefined): { size_unit: string; size: string } | null {
  if (!sizeStr) return null

  const sizeSection = findInformationSection(opts, 'size')
  const unitField = sizeSection?.fields?.find((f: any) => f.mnemonic === 'size_unit')
  const sizeField = sizeSection?.fields?.find((f: any) => f.mnemonic === 'size')

  const unitId = unitField?.values?.[0]?.id
  if (!unitId || !sizeField?.values) return null

  const target = normalize(sizeStr)
  const match = sizeField.values.find((v: any) => {
    const name = normalize(v.displayName)
    const dependsOnUnit = v.dependsOn?.some(
      (d: any) => d.field === 'size_unit' && d.values.includes(unitId)
    )
    return dependsOnUnit && (name === target || name.includes(target) || target.includes(name))
  })

  return match ? { size_unit: String(unitId), size: String(match.id) } : null
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
  return String(num)
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

  if (isBag && hasFormField(opts, 'subcategory')) {
    const subcategoryId = resolveSubcategoryId(opts, l, pageName)
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

  if (!isBag) {
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
