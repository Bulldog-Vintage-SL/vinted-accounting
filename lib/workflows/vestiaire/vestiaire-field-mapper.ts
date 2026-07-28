/*
  Maps listing fields + Vestiaire formOptions to individual preduct_* form entries.
  Vestiaire requires one field per HTTP POST to product-drafts/{draftId}.
*/

import type { WorkflowState, WorkflowStep } from '../types'

const DRAFT_URL = (draftId: string) =>
  `https://apiv2.vestiairecollective.com/product-listing/product-drafts/${draftId}`

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
  return null
}

export function hasFormField(opts: any, mnemonic: string): boolean {
  return Boolean(findField(opts, mnemonic))
}

export function isBagListing(listing: any, opts: any): boolean {
  const itemType = normalize(listing?.item_type)
  if (itemType.includes('bolso') || itemType.includes('bag') || itemType.includes('mochila')) {
    return true
  }
  return hasFormField(opts, 'dimension_31') || hasFormField(opts, 'dimension_30')
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

function resolveConditionId(opts: any, condition: string | undefined): string | null {
  const fromOpts =
    resolveDisplayNameId(opts, 'condition', condition) ??
    resolveDisplayNameIdFuzzy(opts, 'condition', condition)

  if (fromOpts) return fromOpts

  const fallback: Record<string, string> = {
    'nuevo': '9',
    'sin estrenar': '9',
    'como nuevo': '3',
    'bueno': '4',
    'aceptable': '5',
  }
  return fallback[normalize(condition)] ?? '4'
}

function resolveSubcategoryId(opts: any, listing: any, catalogSubcategoryId?: string): string | null {
  const candidates = [listing?.item_type, listing?.title].filter(Boolean) as string[]

  for (const candidate of candidates) {
    const id =
      resolveDisplayNameIdFuzzy(opts, 'subcategory', candidate) ??
      resolveDisplayNameId(opts, 'subcategory', candidate)
    if (id) return id
  }

  return catalogSubcategoryId ? String(catalogSubcategoryId) : null
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

function dimensionFieldMnemonic(dimensionId: number): string {
  return `dimension_${dimensionId}`
}

export function buildVestiaireFieldEntries(s: WorkflowState): Array<{ key: string; value: string }> {
  const l = s.originalPayload?.listing
  const opts = s.vestFormOptions
  const entries: Array<{ key: string; value: string }> = []
  const isBag = isBagListing(l, opts)

  if (isBag && hasFormField(opts, 'subcategory')) {
    const subcategoryId = resolveSubcategoryId(opts, l, s.vestSubcategoryId)
    if (subcategoryId) entries.push({ key: 'preduct_subcategory', value: subcategoryId })
  }

  entries.push({ key: 'preduct_condition', value: resolveConditionId(opts, l?.condition) ?? '4' })

  if (hasFormField(opts, 'model')) {
    entries.push({ key: 'preduct_model', value: '-1' })
  }

  const materialId =
    resolveDisplayNameIdFuzzy(opts, 'material', l?.attributes?.material) ??
    resolveDisplayNameId(opts, 'material', l?.attributes?.material) ??
    '2'
  entries.push({ key: 'preduct_material', value: materialId })

  const colorId = resolveDisplayNameIdFuzzy(opts, 'color', l?.colors?.[0])
  if (colorId) entries.push({ key: 'preduct_color', value: colorId })

  const patternId =
    resolveDisplayNameId(opts, 'pattern', l?.attributes?.pattern ?? 'Ninguno') ??
    resolveDisplayNameId(opts, 'pattern', 'Ninguno')
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

    if (hasFormField(opts, dimensionFieldMnemonic(31))) {
      entries.push({ key: 'preduct_dimension_31', value: String(height) })
    }
    if (hasFormField(opts, dimensionFieldMnemonic(30))) {
      entries.push({ key: 'preduct_dimension_30', value: String(width) })
    }
  }

  entries.push({ key: 'preduct_description', value: l?.description ?? '' })

  entries.push({ key: 'preduct_pvp', value: String(l?.price ?? '') })
  entries.push({ key: 'preduct_currency', value: resolveCurrencyId(opts) })

  if (hasFormField(opts, 'purchase_place')) {
    entries.push({ key: 'preduct_purchase_place', value: '4' })
  }

  return entries.filter(({ value }) => value !== '')
}

export function buildVestiaireFieldSteps(s: WorkflowState): WorkflowStep[] {
  const draftId = s.vestDraftId
  if (!draftId) return []

  return buildVestiaireFieldEntries(s).map(({ key, value }) => ({
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
