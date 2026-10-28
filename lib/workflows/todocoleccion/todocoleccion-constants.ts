export const TC_ORIGIN = 'https://www.todocoleccion.net'
export const TC_API = `${TC_ORIGIN}/api`
export const TC_NEW_LOTE_URL = `${TC_ORIGIN}/mitc/lote/new?clean`
export const TC_CREATE_LOTE_URL = `${TC_ORIGIN}/mitc/lote/create`
export const TC_UPLOAD_IMAGE_URL = `${TC_ORIGIN}/mitc/alta_lote/upload_image/`

export const TC_TITLE_MAX = 80
export const TC_DESCRIPTION_MAX = 4000
export const TC_DEFAULT_WEIGHT_GRAMS = 500
export const TC_WEIGHT_BUCKETS = [500, 2000, 5000, 10000, 20000, 30000] as const

export function snapTodocoleccionWeightGrams(grams: number): number {
  const n = Number.isFinite(grams) && grams > 0 ? Math.round(grams) : TC_DEFAULT_WEIGHT_GRAMS
  return TC_WEIGHT_BUCKETS.find((bucket) => n <= bucket) ?? TC_WEIGHT_BUCKETS[TC_WEIGHT_BUCKETS.length - 1]
}

export const TC_SECTIONS = {
  vintage: 1674,
  vintageModa: 1678,
  vintageModaHombre: 1679,
  vintageModaMujer: 1680,
  vintageModaComplementos: 1681,
  vintageVarios: 1683,
  antiguedadesModaHombre: 1658,
  antiguedadesModaMujer: 1659,
  antiguedadesBolsos: 2606,
  segundaManoRopa: 3081,
} as const

/** Carpetas o nodos que el alta rechaza con «SECCIÓN INCORRECTA». */
export const TC_BRANCH_SECTION_IDS = new Set<number>([
  0, 176, 1657, 1674, 1678, 1679, 1680, 1681, 1241, 1251, 2309, 3078, 3081,
])
