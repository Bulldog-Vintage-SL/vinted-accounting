/*
  Componente de la tabla de los productos, usa swr con la direccion de obtener los productos
  y renderiza la tabla usando DataTable con las columnas definidas en columns.tsx.
*/

'use client'

import useSWR from 'swr'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { applyFieldPatch } from '@/lib/external-integrations/validators'
import { Loader2 } from 'lucide-react'
import { DataTable, DataTableHandle } from '@/components/ui/data-table'
import { PageLoader } from '@/components/ui/page-loader'
import { LoadingButton } from '@/components/ui/loading-button'
import { createColumns } from './columns'
import { deleteListing } from '../actions'
import { SelectedAccount, useAccountSelector } from '@/hooks/useAccountSelector'
import { useQueue } from '@/hooks/useQueue'
import { QueueStatusBar } from '@/components/QueueStatusBar'
import { PublishProgressModal } from './PublishProgressModal'
import { Listing, ListingForm } from '../types'
import { useToast } from "@/components/toast"
import { DeleteListingModal } from './DeleteListingModal'
import type { Job } from '@/lib/queue/types'

const fetcher = (url: string) => fetch(url).then(res => res.json())

type UploadJob = {
  listing: Listing
  account: SelectedAccount
}

type PublishPhase = 'idle' | 'publishing' | 'done'

export function ListingsTable() {
  const { data, error, isLoading, mutate } = useSWR('/api/listings', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
  })

  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [listingToDelete, setListingToDelete] = useState<Listing | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)
  const [listingsToDelete, setListingsToDelete] = useState<Listing[]>([])
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  const [isBulkPublishing, setIsBulkPublishing] = useState(false)
  const [publishingListingId, setPublishingListingId] = useState<string | null>(null)

  const { pushToast } = useToast()

  const openSelector = useAccountSelector(s => s.openSelector)
  const selectorOpen = useAccountSelector(s => s.open)

  const [showQueue, setShowQueue] = useState(false)
  const { enqueue, clear, stats, isPaused, pause, resume, retryFailed, onDrained, retryJobWithPatch, onEvent } = useQueue<Listing>()

  const tableRef = useRef<DataTableHandle>(null)

  const isQueueBusy = stats.pending > 0 || stats.processing > 0

  // Modal de progreso bloqueante para la publicación (individual o masiva)
  const [publishPhase, setPublishPhase] = useState<PublishPhase>('idle')
  const publishJobsRef = useRef<Job<'upload', Listing>[]>([])
  const [, forceTick] = useState(0)

  useEffect(() => {
    if (!selectorOpen) {
      setPublishingListingId(null)
      setIsBulkPublishing(false)
    }
  }, [selectorOpen])

  // Barra de progreso
  useEffect(() => {
    if (stats.total > 0) {
      setShowQueue(true)
    }
  }, [stats.total])

  useEffect(() => {
    const allDone = stats.total > 0
      && stats.pending === 0
      && stats.processing === 0

    if (allDone) {
      setShowQueue(false)
    }
  }, [stats])

  useEffect(() => {
    return onDrained(() => {
      tableRef.current?.resetSelection()
      setSelectedIds([])
    })
  }, [onDrained])

  // Mientras el modal de publicación esta abierto
  useEffect(() => {
    if (publishPhase !== 'publishing') return

    const unsubscribe = onEvent(() => {
      forceTick((t) => t + 1)

      const allDone = publishJobsRef.current.every(
        (j) => j.status === 'completed' || j.status === 'failed'
      )
      if (allDone && publishJobsRef.current.length > 0) {
        setPublishPhase('done')
      }
    })

    return unsubscribe
  }, [publishPhase, onEvent])

  const handlePublish = useCallback((listing: Listing) => {
    setPublishingListingId(listing.id)

    openSelector((accounts) => {
      setPublishingListingId(null)

      if (accounts.length === 0) return

      const jobsPayload = accounts.map(account => ({
        listing,
        account,
      }))

      clear()

      const jobs = enqueue('upload', jobsPayload as unknown as Listing[], {}, (item) => {
        const { listing: jobListing, account } = item as unknown as UploadJob
        return `${jobListing.title} en ${account.platform}`
      })

      publishJobsRef.current = jobs
      setPublishPhase('publishing')
    })
  }, [openSelector, clear, enqueue])

  // Publicacion masiva
  const handleBulkPublish = useCallback(() => {
    const selected: Listing[] = (data ?? []).filter((l: Listing) => selectedIds.includes(l.id))
    if (selected.length === 0) return

    setIsBulkPublishing(true)

    openSelector((accounts) => {
      setIsBulkPublishing(false)

      if (accounts.length === 0) return

      const allJobs: UploadJob[] = []
      for (const listing of selected) {
        for (const account of accounts) {
          allJobs.push({ listing, account })
        }
      }

      clear()

      const jobs = enqueue('upload', allJobs as unknown as Listing[], {}, (item) => {
        const { listing, account } = item as unknown as UploadJob
        return `${listing.title} en ${account.platform}`
      })

      publishJobsRef.current = jobs
      setPublishPhase('publishing')

      setSelectedIds([])
      tableRef.current?.resetSelection()
    })
  }, [data, selectedIds, openSelector, clear, enqueue])

  const handleClosePublishModal = useCallback(() => {
    setPublishPhase('idle')
    publishJobsRef.current = []
  }, [])

  const handleBulkDeleteClick = useCallback(() => {
    const selected: Listing[] = (data ?? []).filter((l: Listing) => selectedIds.includes(l.id))
    if (selected.length === 0) return

    setListingsToDelete(selected)
    setBulkDeleteModalOpen(true)
  }, [data, selectedIds])

  const handleConfirmBulkDelete = useCallback(() => {
    if (listingsToDelete.length === 0) return

    setIsBulkDeleting(true)

    const idsToDelete = new Set(listingsToDelete.map(l => l.id))
    mutate(
      (current: Listing[] | undefined) => (current ?? []).filter(l => !idsToDelete.has(l.id)),
      false
    )
    setSelectedIds([])
    tableRef.current?.resetSelection()

    clear()

    enqueue('delete', listingsToDelete, {}, (l: Listing) => l.title)

    setBulkDeleteModalOpen(false)
    setListingsToDelete([])
    setIsBulkDeleting(false)
  }, [listingsToDelete, mutate, clear, enqueue])

  const handleDeleteClick = useCallback((id: string) => {
    const listing = (data ?? []).find((l: Listing) => l.id === id)
    if (listing) {
      setListingToDelete(listing)
      setDeleteModalOpen(true)
    }
  }, [data])

  const handleConfirmDelete = useCallback(async () => {
    if (!listingToDelete) return

    setIsDeleting(true)

    mutate(
      (current: Listing[] | undefined) => (current ?? []).filter(l => l.id !== listingToDelete.id),
      false
    )

    try {
      await deleteListing(listingToDelete.id)
      mutate()
      pushToast({
        message: 'Producto eliminado',
        description: `"${listingToDelete.title}" ha sido eliminado correctamente.`,
        type: 'success',
      })
      setDeleteModalOpen(false)
      setListingToDelete(null)
    } catch (err) {
      console.error('Error deleting listing:', err)
      mutate()
      pushToast({
        message: 'Error al eliminar',
        description: 'No se pudo eliminar el producto. Inténtalo de nuevo.',
        type: 'error',
      })
    } finally {
      setIsDeleting(false)
    }
  }, [listingToDelete, mutate, pushToast])

  const columns = useMemo(
    () => createColumns(handleDeleteClick, handlePublish, publishingListingId),
    [handleDeleteClick, handlePublish, publishingListingId]
  )

  if (isLoading) return <PageLoader label="Cargando productos..." />
  if (error) return <div className="p-4 text-red-500">Error cargando listings</div>

  return (
    <div className="w-full">
      {showQueue && publishPhase === 'idle' && (
        <QueueStatusBar
          stats={stats}
          isPaused={isPaused}
          onPause={pause}
          onResume={resume}
          onRetryFailed={retryFailed}
        />
      )}

      <DataTable
        ref={tableRef}
        columns={columns}
        data={data ?? []}
        onSelectionChange={setSelectedIds}
      />

      {selectedIds.length > 0 && (
        <div className="mb-3 flex justify-between items-center bg-blue-50 p-3 rounded-md gap-2">
          <span className="text-sm text-gray-700">{selectedIds.length} seleccionados</span>
          <div className="flex gap-2">
            <LoadingButton
              onClick={handleBulkPublish}
              loading={isBulkPublishing}
              loadingText="Publicando..."
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
            >
              Publicar seleccionados
            </LoadingButton>
            <LoadingButton
              onClick={handleBulkDeleteClick}
              loading={isBulkDeleting}
              loadingText="Eliminando..."
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
            >
              Eliminar seleccionados
            </LoadingButton>
          </div>
        </div>
      )}

      {isQueueBusy && selectedIds.length === 0 && publishPhase === 'idle' && (
        <div className="mb-3 flex items-center gap-2 text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded-md">
          <Loader2 className="h-4 w-4 animate-spin" />
          Procesando operaciones en segundo plano...
        </div>
      )}

      <PublishProgressModal
        open={publishPhase !== 'idle'}
        jobs={publishJobsRef.current}
        isBusy={publishPhase === 'publishing'}
        onClose={handleClosePublishModal}
        onRetryJob={async (job, patch) => {
          const uploadJob = job.entity as unknown as UploadJob
          const currentListing = uploadJob.listing

          const formPayload = applyFieldPatch(listingToForm(currentListing), patch)

          try {
            const res = await fetch(`/api/listings/${currentListing.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(formPayload),
            })

            if (!res.ok) {
              const data = await res.json().catch(() => null)
              pushToast({
                message: 'Error al guardar',
                description: data?.error || 'No se pudieron guardar los cambios del producto.',
                type: 'error',
              })
              return
            }

            const updatedListing = await res.json()
            mutate()

            retryJobWithPatch(job.id, (entity) => {
              const uj = entity as unknown as UploadJob
              return {
                ...uj,
                listing: updatedListing,
              } as unknown as Listing
            })

          } catch (err) {
            console.error('Error guardando el listing:', err)
            pushToast({
              message: 'Error al guardar',
              description: 'No se pudo conectar con el servidor.',
              type: 'error',
            })
          }
        }}
      />

      <DeleteListingModal
        open={deleteModalOpen}
        onClose={() => {
          if (isDeleting) return
          setDeleteModalOpen(false)
          setListingToDelete(null)
        }}
        onConfirm={handleConfirmDelete}
        productName={listingToDelete?.title}
        isLoading={isDeleting}
      />

      <DeleteListingModal
        open={bulkDeleteModalOpen}
        onClose={() => {
          if (isBulkDeleting) return
          setBulkDeleteModalOpen(false)
          setListingsToDelete([])
        }}
        onConfirm={handleConfirmBulkDelete}
        productName={
          listingsToDelete.length === 1
            ? listingsToDelete[0]?.title
            : `${listingsToDelete.length} productos seleccionados`
        }
        isLoading={isBulkDeleting}
      />
    </div>
  )
}

function listingToForm(listing: Listing): ListingForm {
  return {
    title: listing.title,
    description: listing.description,
    condition: listing.condition,
    price: listing.price,
    photo_url: listing.photo_url,
    colors: listing.colors,
    attributes: {
      brand: listing.attributes?.brand ?? '',
      size: listing.attributes?.size ?? '',
    },
    gender: listing.gender,
    item_type: listing.item_type,
    stock: listing.stock,
  }
}