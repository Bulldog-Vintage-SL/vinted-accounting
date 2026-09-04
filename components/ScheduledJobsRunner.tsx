'use client'
/*
  Runner de publicaciones programadas.
*/

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueue } from '@/hooks/useQueue'
import { applyFieldPatch } from '@/lib/external-integrations/validators'
import type { Job } from '@/lib/queue/types'
import type { Listing, ListingForm } from '@/app/inventory/listings/types'
import type { SelectedAccount } from '@/hooks/useAccountSelector'
import { PublishProgressModal } from '@/app/inventory/listings/components/PublishProgressModal'

const POLL_INTERVAL_MS = 20000

interface UploadJobAccount {
  accountId: string
  platform: string
}

interface UploadJobDoc {
  id: string
  listingId: string
  accounts: UploadJobAccount[]
  scheduledAt: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
}

type UploadJobPayload = { listing: Listing; account: SelectedAccount }

interface TrackedEntry {
  uploadJobId: string
  queueJobIds: Set<string>
}

type ModalPhase = 'idle' | 'running' | 'done'

async function patchJob(id: string, body: Record<string, unknown>) {
  return fetch(`/api/upload-jobs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Misma función que ListingsTable usa para convertir un Listing en el
// payload de PATCH /api/listings/:id al reintentar con campos corregidos.
function listingToForm(listing: Listing): ListingForm {
  return {
    title: listing.title,
    description: listing.description,
    condition: listing.condition,
    price: listing.price,
    photo_url: listing.photo_url,
    colors: listing.colors,
    sku: listing.sku,
    attributes: {
      brand: listing.attributes?.brand ?? '',
      size: listing.attributes?.size ?? '',
      categoryPath: listing.attributes?.categoryPath ?? '',
      vintedCategoryId: listing.attributes?.vintedCategoryId ?? 0,
    },
    gender: listing.gender,
    item_type: listing.item_type,
    stock: listing.stock,
  }
}

export function ScheduledJobsRunner() {
  const { enqueue, jobs, retryJobWithPatch } = useQueue<Listing>()

  const inFlightRef = useRef<Set<string>>(new Set())
  const trackedRef = useRef<Map<string, TrackedEntry>>(new Map())

  const visibleJobIdsRef = useRef<Set<string>>(new Set())

  const [phase, setPhase] = useState<ModalPhase>('idle')
  const [visibleJobs, setVisibleJobs] = useState<Job<'upload', Listing>[]>([])

  const finalizeUploadJob = useCallback(
    async (uploadJobId: string, relevantQueueJobs: Job<'upload', Listing>[]) => {
      const failed = relevantQueueJobs.filter((j) => j.status === 'failed')
      const wasLast = trackedRef.current.size === 1

      try {
        if (failed.length === 0) {
          await patchJob(uploadJobId, { status: 'completed' })
        } else {
          const errorMsg =
            failed
              .map((j) => (j as unknown as { error?: { message?: string } }).error?.message)
              .filter(Boolean)
              .join('; ') || 'Una o más publicaciones fallaron'

          await patchJob(uploadJobId, { status: 'failed', error: errorMsg })
        }
      } catch (err) {
        console.error('Error actualizando estado final del upload job:', err)
      } finally {
        trackedRef.current.delete(uploadJobId)
        inFlightRef.current.delete(uploadJobId)
        if (wasLast) {
          setPhase('done')
        }
      }
    },
    []
  )

  useEffect(() => {
    if (visibleJobIdsRef.current.size > 0) {
      setVisibleJobs(
        jobs.filter((j) => visibleJobIdsRef.current.has(j.id)) as Job<'upload', Listing>[]
      )
    }

    trackedRef.current.forEach((entry, uploadJobId) => {
      const relevant = jobs.filter((j) => entry.queueJobIds.has(j.id)) as Job<'upload', Listing>[]
      if (relevant.length === 0) return

      const allDone = relevant.every(
        (j) => j.status === 'completed' || j.status === 'failed'
      )
      if (allDone) {
        finalizeUploadJob(uploadJobId, relevant)
      }
    })
  }, [jobs, finalizeUploadJob])

  useEffect(() => {
    let cancelled = false

    async function runDueJob(job: UploadJobDoc) {
      inFlightRef.current.add(job.id)

      // Ya no hace falta lockear aquí: GET /api/upload-jobs?due=true
      // reclama el job atómicamente (pending -> processing) en el servidor
      // antes de devolverlo, así que si llegó hasta aquí ya es "nuestro".

      try {
        const listingRes = await fetch(`/api/listings/${job.listingId}`)
        if (!listingRes.ok) {
          throw new Error('No se pudo cargar el producto')
        }
        const listing: Listing = await listingRes.json()

        if (listing.status === 'sold') {
          throw new Error('El producto ya está marcado como vendido')
        }

        const payload: UploadJobPayload[] = job.accounts.map((account) => ({
          listing,
          account: account as unknown as SelectedAccount,
        }))

        const queueJobs = enqueue(
          'upload',
          payload as unknown as Listing[],
          {},
          (item) => {
            const { listing: l, account } = item as unknown as UploadJobPayload
            return `${l.title} en ${account.platform} (programado)`
          }
        )

        trackedRef.current.set(job.id, {
          uploadJobId: job.id,
          queueJobIds: new Set(queueJobs.map((j) => j.id)),
        })

        queueJobs.forEach((j) => visibleJobIdsRef.current.add(j.id))
        setVisibleJobs((prev) => [...prev, ...queueJobs])
        setPhase('running')
      } catch (err) {
        await patchJob(job.id, {
          status: 'failed',
          error: err instanceof Error ? err.message : 'Error desconocido',
        }).catch(() => { })
        inFlightRef.current.delete(job.id)
      }
    }

    async function tick() {
      try {
        const res = await fetch('/api/upload-jobs?due=true')
        if (!res.ok) return
        const dueJobs: UploadJobDoc[] = await res.json()

        for (const job of dueJobs) {
          if (cancelled) return
          if (inFlightRef.current.has(job.id)) continue
          runDueJob(job)
        }
      } catch (err) {
        console.error('Error consultando jobs programados:', err)
      }
    }

    tick()
    const interval = setInterval(tick, POLL_INTERVAL_MS)
    console.log("tick")

    return () => {
      cancelled = true
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enqueue])

  const handleCloseModal = useCallback(() => {
    if (phase === 'running') return // bloqueado mientras se ejecuta
    setPhase('idle')
    setVisibleJobs([])
    visibleJobIdsRef.current.clear()
  }, [phase])

  const handleRetryJob = useCallback(
    async (job: Job<'upload', Listing>, patch: Partial<ListingForm>) => {
      const uploadJob = job.entity as unknown as UploadJobPayload
      const currentListing = uploadJob.listing

      const formPayload = applyFieldPatch(listingToForm(currentListing), patch)

      try {
        const res = await fetch(`/api/listings/${currentListing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formPayload),
        })

        if (!res.ok) return

        const updatedListing = await res.json()

        retryJobWithPatch(job.id, (entity) => {
          const uj = entity as unknown as UploadJobPayload
          return { ...uj, listing: updatedListing } as unknown as Listing
        })
      } catch (err) {
        console.error('Error reintentando job programado:', err)
      }
    },
    [retryJobWithPatch]
  )

  return (
    <PublishProgressModal
      open={phase !== 'idle'}
      jobs={visibleJobs}
      isBusy={phase === 'running'}
      onClose={handleCloseModal}
      onRetryJob={handleRetryJob}
    />
  )
}