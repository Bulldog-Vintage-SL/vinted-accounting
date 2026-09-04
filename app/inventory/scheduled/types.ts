import type { Listing } from '@/app/inventory/listings/types'

export type ScheduledUploadAccount = {
  accountId: string
  platform: string
}

export type PopulatedListingRef = {
  id: string
  title: string
  photoUrl: string[]
}

export type ScheduledUploadJob = {
  id: string
  listingId: PopulatedListingRef | string
  accounts: ScheduledUploadAccount[]
  scheduledAt: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error: string | null
  createdAt: string
}