import {
  TC_BRANCH_SECTION_IDS,
  TC_DEFAULT_WEIGHT_GRAMS,
  TC_SECTIONS,
  snapTodocoleccionWeightGrams,
} from './todocoleccion-constants'

type SectionHit = {
  id?: number | string
  title?: string
  name?: string
  long_title?: string
  parent_long_title?: string
}

export function pickTodocoleccionUserId(result: any): string {
  const id =
    result?.userId ??
    result?.user_id ??
    result?.id ??
    result?.data?.id ??
    result?.data?.user?.id
  return id != null ? String(id) : ''
}

export function pickTodocoleccionImageKey(result: any): string {
  const key =
    result?.imageKey ??
    result?.image_key ??
    result?.data?.image_key ??
    result?.lote?.image_key
  return key != null ? String(key) : ''
}

function normalize(value: string | undefined | null): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

const CLOTHING_RE =
  /\b(jeans?|vaquero|pantalon|sudadera|camisa|camiseta|chaqueta|dress|pants|ropa|hoodie|abrigo|falda|jersey|chino|shirt|jacket|coat)\b/

const ACCESSORY_RE =
  /\b(clutch|pouch|bolso|bag|monedero|cintur|belt|bufanda|scarf|complemento|accesorio|accessory|cartera|wallet|sombrero|hat|gafa|sunglass|toiletry|neceser)\b/

export function todocoleccionSectionQuery(listing: any): string {
  const title = String(listing?.title ?? '').trim()
  if (title) return title
  return listing?.gender === 'mujer' ? 'ropa vintage mujer' : 'ropa vintage hombre'
}

export function todocoleccionSectionHint(listing: any): { query: string; want: string } {
  const haystack = normalize(`${listing?.item_type ?? ''} ${listing?.title ?? ''}`)
  if (ACCESSORY_RE.test(haystack)) return { query: 'bolso', want: 'Bolsos' }
  if (listing?.gender === 'mujer' || /\b(vestido|dress|falda|mujer)\b/.test(haystack)) {
    return { query: 'moda', want: 'Mujer' }
  }
  if (CLOTHING_RE.test(haystack)) return { query: 'moda', want: 'Hombre' }
  return { query: 'moda', want: 'Complementos' }
}

function isListableSection(id: number): boolean {
  return Number.isFinite(id) && id > 0 && !TC_BRANCH_SECTION_IDS.has(id)
}

function defaultSection(listing: any, clothing: boolean): number {
  const haystack = normalize(`${listing?.item_type ?? ''} ${listing?.title ?? ''}`)
  if (ACCESSORY_RE.test(haystack)) return TC_SECTIONS.antiguedadesBolsos
  if (clothing) return TC_SECTIONS.vintageVarios
  return TC_SECTIONS.vintageVarios
}

export function pickTodocoleccionSectionId(
  result: any,
  listing: any
): number {
  const raw =
    result?.data?.sections ??
    result?.sections ??
    result?.data?.secciones ??
    result?.secciones ??
    result?.data ??
    result
  const sections: SectionHit[] = Array.isArray(raw) ? raw : []
  const gender = listing?.gender
  const haystack = normalize(
    `${listing?.item_type ?? ''} ${listing?.title ?? ''} ${listing?.attributes?.brand ?? ''}`
  )
  const clothing = CLOTHING_RE.test(haystack)
  const fallback = defaultSection(listing, clothing)

  const scored = sections
    .map((section) => {
      const id = Number(section.id)
      if (!isListableSection(id)) return { id, score: -1 }
      const text = normalize(
        `${section.title ?? ''} ${section.name ?? ''} ${section.long_title ?? ''} ${section.parent_long_title ?? ''}`
      )
      let score = 0
      if (id === TC_SECTIONS.antiguedadesBolsos) score += ACCESSORY_RE.test(haystack) ? 20 : 0
      if (ACCESSORY_RE.test(haystack) && text.includes('bolso')) score += 12
      if (id === TC_SECTIONS.vintageVarios) score += ACCESSORY_RE.test(haystack) ? 0 : 12
      if (text.includes('vintage') && text.includes('varios')) score += ACCESSORY_RE.test(haystack) ? 0 : 8
      if (text.includes('vintage')) score += 3
      if (gender === 'mujer' && text.includes('mujer')) score += 2
      if (gender !== 'mujer' && text.includes('hombre')) score += 2
      if (clothing && text.includes('complemento')) score -= 4
      if (text.includes('lampara') || text.includes('mueble') || text.includes('decoracion')) score -= 3
      if (text.includes('playmobil') || text.includes('juguete') || text.includes('cromo') || text.includes('dvd')) score -= 6
      return { id, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored[0]?.id || fallback
}

export function pickTodocoleccionWeightGrams(listing: any): number {
  const explicit = Number(listing?.attributes?.weightGrams ?? listing?.attributes?.weight)
  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit >= 50 ? Math.round(explicit) : Math.round(explicit * 1000)
  }
  const hay = `${listing?.title ?? ''} ${listing?.description ?? ''}`
  const kg = hay.match(/(\d+(?:[.,]\d+)?)\s*k(?:g|ilos?)/i)
  if (kg) return Math.round(Number(kg[1].replace(',', '.')) * 1000)
  const g = hay.match(/(\d+)\s*g(?:ramos?)?/i)
  if (g) return Number(g[1])
  return TC_DEFAULT_WEIGHT_GRAMS
}

export function pickTodocoleccionFotoNames(photos: any[] | undefined): string {
  const names: string[] = []
  for (const photo of photos ?? []) {
    const files = photo?.files ?? photo?.data?.files
    if (Array.isArray(files)) {
      for (const file of files) {
        if (file?.name) names.push(String(file.name))
      }
    } else if (photo?.name) {
      names.push(String(photo.name))
    }
  }
  return names.join(',')
}

export function pickTodocoleccionListing(result: any): { id: string; url: string } {
  const payload = result?.data ?? result ?? {}
  const url = String(payload.url ?? payload.pretty_url ?? payload.lote_url ?? '')
  if (/buscador|ayuda\/|\/acceder|\/mitc\/lote\/(?:new|create)|todocoleccion\.net\/?$/i.test(url)) {
    return { id: '', url: '' }
  }
  const fromUrl = url.match(/~x?(\d{6,})/i)?.[1] || ''
  const id = payload.id ?? payload.lote_id ?? payload.loteId ?? fromUrl ?? ''
  return { id: String(id || ''), url }
}

export function pickTodocoleccionShippingCost(result: any): string {
  const value =
    result?.costs ??
    result?.cost ??
    result?.price ??
    result?.importe ??
    result?.data?.price ??
    result?.data?.costs
  if (value == null || value === '') return ''
  return String(value)
}

export function buildTodocoleccionCreateBody(s: {
  originalPayload?: any
  tcImageKey?: string
  tcAltaLote?: string
  tcSectionId?: number
  tcCsrf?: string | null
  tcFormFields?: Record<string, string>
  tcWeightGrams?: number
  tcShippingCost?: string
  tcSubmitName?: string
  tcSubmitValue?: string
  tcPhotos?: any[]
}): Record<string, any> {
  const listing = s.originalPayload?.listing ?? {}
  const hint = todocoleccionSectionHint(listing)
  const price = Number(listing.price)
  const title = String(listing.title ?? '')
  const description = String(listing.description ?? '')
  const fields = { ...(s.tcFormFields ?? {}) }
  delete fields.titulo
  delete fields.precio
  delete fields.peso
  delete fields['files[]']
  delete fields.file
  const section = String(s.tcSectionId ?? fields.section ?? '0')
  const weight = String(
    snapTodocoleccionWeightGrams(s.tcWeightGrams ?? pickTodocoleccionWeightGrams(listing))
  )
  const fotos = pickTodocoleccionFotoNames(s.tcPhotos) || fields.fotos || ''
  const body: Record<string, any> = {
    ...fields,
    image_key: s.tcImageKey,
    alta_lote: s.tcAltaLote || fields.alta_lote || '',
    Titulo: title,
    section,
    m: /^\d+$/.test(section) && section !== '0' ? section : fields.m ?? '0',
    weight,
    imagen: fields.imagen ?? 's',
    fotos,
    plupload_sended: fotos ? 'true' : fields.plupload_sended ?? 'false',
    descripcion: description,
    Precio: Number.isFinite(price) && price > 0 ? String(price) : '1',
    Estado: fields.Estado ?? '3',
    Descrip_Estado: fields.Descrip_Estado ?? '',
    Modo_Venta: fields.Modo_Venta ?? 'v',
    shipping_method: fields.shipping_method ?? '2',
    costs: s.tcShippingCost || fields.costs || '',
    Referencia: fields.Referencia ?? '',
    Observaciones: fields.Observaciones ?? '',
    _tcSectionQuery: hint.query,
    _tcSectionWant: hint.want,
  }
  if (s.tcCsrf) {
    body._csrf = s.tcCsrf
    body.csrf_token = s.tcCsrf
  }
  if (s.tcSubmitName) body[s.tcSubmitName] = s.tcSubmitValue || 'Subir'
  return body
}
