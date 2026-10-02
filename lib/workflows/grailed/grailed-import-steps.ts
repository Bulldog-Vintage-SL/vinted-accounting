import type { WorkflowStep } from '../types'
import { GRAILED_API_BASE } from './grailed-mapper'

export const GRAILED_WARDROBE_PAGE_SIZE = 40

export function buildGrailedWardrobeUrl(userId: string, page = 1): string {
  const params = new URLSearchParams({
    user_id: String(userId),
    sold: 'false',
    page: String(page),
    per_page: String(GRAILED_WARDROBE_PAGE_SIZE),
  })
  return `${GRAILED_API_BASE}/api/listings?${params.toString()}`
}

export function buildImportGrailedWardrobeSteps(userId: string): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'grailed',
      type: 'GET_GRAILED_WARDROBE',
      request: {
        url: buildGrailedWardrobeUrl(userId, 1),
        method: 'GET',
      },
    },
  ]
}

export function extractGrailedListings(result: any): any[] {
  if (Array.isArray(result)) return result
  if (Array.isArray(result?.data)) return result.data
  if (Array.isArray(result?.listings)) return result.listings
  if (Array.isArray(result?.hits)) return result.hits
  if (Array.isArray(result?.items)) return result.items
  if (Array.isArray(result?.data?.listings)) return result.data.listings
  if (Array.isArray(result?.data?.hits)) return result.data.hits
  return []
}

export function grailedWardrobeHasMore(result: any, pageItems: number, page: number): boolean {
  const meta = result?.meta ?? result?.pagination ?? result?.data?.meta ?? {}
  const current = Number(meta.current_page ?? meta.page ?? page)
  const totalPages = Number(meta.total_pages ?? meta.nbPages ?? meta.totalPages ?? 0)
  if (totalPages > 0) return current < totalPages

  const total = Number(meta.total ?? result?.nbHits ?? result?.total ?? 0)
  if (total > 0) return page * GRAILED_WARDROBE_PAGE_SIZE < total

  return pageItems >= GRAILED_WARDROBE_PAGE_SIZE
}
