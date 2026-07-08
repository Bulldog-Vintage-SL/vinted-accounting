/*
  Componente de la tabla de los productos, usa swr con la direccion de obtener los productos
  y renderiza la tabla usando DataTable con las columnas definidas en columns.tsx.
*/

'use client'

import useSWR from 'swr'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { DataTable, DataTableHandle } from '@/components/ui/data-table'
import { createColumns } from './columns'
import { deleteListing } from '../actions'
import { useAccountSelector } from '@/hooks/useAccountSelector'
import { useQueue } from '@/hooks/useQueue'
import { QueueStatusBar } from '@/components/QueueStatusBar'
import { Listing } from '../types'
import { useToast } from "@/components/toast"
import { DeleteListingModal } from './DeleteListingModal'

const fetcher = (url: string) => fetch(url).then(res => res.json())

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
  
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)
  const [listingsToDelete, setListingsToDelete] = useState<Listing[]>([])

  const { pushToast } = useToast()

  const openSelector = useAccountSelector(s => s.openSelector)

  const [showQueue, setShowQueue] = useState(false)
  const { enqueue, clear, stats, isPaused, pause, resume, retryFailed, onDrained, onEvent } = useQueue()

  const tableRef = useRef<DataTableHandle>(null)

  // Refs estables para callbacks
  const pushToastRef = useRef(pushToast)
  pushToastRef.current = pushToast

  const mutateRef = useRef(mutate)
  mutateRef.current = mutate

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
      && stats.retrying === 0

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

  // Publicacion masiva
  const handleBulkPublish = () => {
    const selected: Listing[] = (data ?? []).filter((l: Listing) => selectedIds.includes(l.id))
    if (selected.length === 0) return

    openSelector((accounts) => {
      if (accounts.length === 0) return
      
      const allJobs: Array<{ listing: Listing; account: typeof accounts[0] }> = []
      for (const listing of selected) {
        for (const account of accounts) {
          allJobs.push({ listing, account })
        }
      }

      clear()

      enqueue('upload', allJobs, {}, (item) => {
        const { listing, account } = item as typeof allJobs[0]
        return `${listing.title} en ${account.platform}`
      })
      
      setSelectedIds([])
      tableRef.current?.resetSelection()
    })
  }

  const handleBulkDeleteClick = () => {
    const selected: Listing[] = (data ?? []).filter((l: Listing) => selectedIds.includes(l.id))
    if (selected.length === 0) return
    
    setListingsToDelete(selected)
    setBulkDeleteModalOpen(true)
  }

  const handleConfirmBulkDelete = useCallback(() => {
    if (listingsToDelete.length === 0) return

    const idsToDelete = new Set(listingsToDelete.map(l => l.id))
    mutate(
      (current: Listing[] | undefined) => (current ?? []).filter(l => !idsToDelete.has(l.id)),
      false
    )
    setSelectedIds([])
    tableRef.current?.resetSelection()
    setBulkDeleteModalOpen(false)
    setListingsToDelete([])

    clear()

    enqueue('delete', listingsToDelete, {}, (l: Listing) => l.title)
  }, [listingsToDelete, mutate, enqueue])

  const handleDeleteClick = useCallback((id: string) => {
    const listing = (data ?? []).find((l: Listing) => l.id === id)
    if (listing) {
      setListingToDelete(listing)
      setDeleteModalOpen(true)
    }
  }, [data])

  const handleConfirmDelete = useCallback(async () => {
    if (!listingToDelete) return

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
    } catch (err) {
      console.error('Error deleting listing:', err)
      mutate()
      pushToast({
        message: 'Error al eliminar',
        description: 'No se pudo eliminar el producto. Inténtalo de nuevo.',
        type: 'error',
      })
    } finally {
      setDeleteModalOpen(false)
      setListingToDelete(null)
    }
  }, [listingToDelete, mutate, pushToast])

  const columns = useMemo(
    () => createColumns(handleDeleteClick, openSelector, pushToast, enqueue),
    [handleDeleteClick, openSelector, pushToast, enqueue]
  )

  if (isLoading) return <div className="p-4 text-gray-500">Cargando...</div>
  if (error) return <div className="p-4 text-red-500">Error cargando listings</div>

  return (
    <div className="w-full">
      {showQueue && (
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
            <button onClick={handleBulkPublish} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">
              Publicar seleccionados
            </button>
            <button onClick={handleBulkDeleteClick} className="bg-red-600 text-white px-3 py-1 rounded text-sm">
              Eliminar seleccionados
            </button>
          </div>
        </div>
      )}

      <DeleteListingModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false)
          setListingToDelete(null)
        }}
        onConfirm={handleConfirmDelete}
        productName={listingToDelete?.title}
      />

      <DeleteListingModal
        open={bulkDeleteModalOpen}
        onClose={() => {
          setBulkDeleteModalOpen(false)
          setListingsToDelete([])
        }}
        onConfirm={handleConfirmBulkDelete}
        productName={
          listingsToDelete.length === 1 
            ? listingsToDelete[0]?.title 
            : `${listingsToDelete.length} productos seleccionados`
        }
      />
    </div>
  )
}