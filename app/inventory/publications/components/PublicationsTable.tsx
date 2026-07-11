'use client'

import useSWR from 'swr'
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { DataTable, DataTableHandle } from '@/components/ui/data-table'
import { createColumns } from './columns'
import { Publication } from '../types'
import { DeletePublicationModal } from './DeletePublicationModal'
import { BulkDeletePublicationModal } from './BulkDeletePublicationModal'
import { EditPublicationModal } from './EditPublicationModal'
import { useToast } from '@/components/toast'
import { useQueue } from '@/hooks/useQueue'
import { QueueStatusBar } from '@/components/QueueStatusBar'
import { deleteVintedItem, deleteWallapopItem, deleteVestiaireItem } from '@/lib/extensionBridge'

const fetcher = (url: string) => fetch(url).then(res => res.json()).then(res => res.data)

// Elimar una publicacion
async function deletePublication(publication: Publication): Promise<void> {
    if (publication.platform === 'vinted') {
        const result = await deleteVintedItem(publication.external_id, publication.id);
        if (!result.ok) throw new Error(result.message);
    } else if (publication.platform === 'wallapop') {
        const result = await deleteWallapopItem(publication.external_id, publication.id);
        if (!result.ok) throw new Error(result.message);
    } else if (publication.platform === 'vestiaire') {
        const result = await deleteVestiaireItem(publication.external_id, publication.id);
        if (!result.ok) throw new Error(result.message);
       
    } else if (publication.platform === 'shopify') {
        const res = await fetch('/api/shopify/delete-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicationId: publication.id }),
        })
        const data = await res.json()
        if (!res.ok || !data?.ok) {
            throw new Error(`Shopify: ${data?.error || 'Error desconocido'}`)
        }
    }
    // Si no existe tal plataforma eliminamos de la base de datos
    else {
        const response = await fetch(`/api/publications?id=${publication.id}`, { method: 'DELETE' });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al eliminar');
        }
    }
}

export function PublicationsTable() {
    const { data, error, isLoading, mutate } = useSWR('/api/publications', fetcher, {
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        revalidateIfStale: true,
        revalidateOnMount: true,
    })

    const { pushToast } = useToast()
    const tableRef = useRef<DataTableHandle>(null)
    const { enqueue, clear, stats, isPaused, pause, resume, retryFailed, onDrained } = useQueue<Publication>()

    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [showQueue, setShowQueue] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    // Efectos para barra de progreso (igual que antes)
    useEffect(() => {
        if (stats.total > 0) setShowQueue(true)
    }, [stats.total])

    useEffect(() => {
        const allDone = stats.total > 0 && stats.pending === 0 && stats.processing === 0 && stats.retrying === 0
        if (allDone) setShowQueue(false)
    }, [stats])

    useEffect(() => {
        return onDrained(() => {
            tableRef.current?.resetSelection()
            setSelectedIds([])
        })
    }, [onDrained])

    // Estados para modales
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [publicationToDelete, setPublicationToDelete] = useState<Publication | null>(null)
    const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)
    const [publicationsToDelete, setPublicationsToDelete] = useState<Publication[]>([])
    const [editModalOpen, setEditModalOpen] = useState(false)
    const [publicationToEdit, setPublicationToEdit] = useState<Publication | null>(null)

    const handleDeleteClick = useCallback((id: string) => {
        const publication = (data ?? []).find((p: Publication) => p.id === id)
        if (publication) {
            setPublicationToDelete(publication)
            setDeleteModalOpen(true)
        }
    }, [data])

    const handleEditClick = useCallback((id: string) => {
        const publication = (data ?? []).find((p: Publication) => p.id === id)
        if (publication) {
            setPublicationToEdit(publication)
            setEditModalOpen(true)
        }
    }, [data])

    const handleConfirmDelete = useCallback(async () => {
        if (!publicationToDelete) return

        setIsDeleting(true)

        mutate(
            (current: Publication[] | undefined) => (current ?? []).filter(p => p.id !== publicationToDelete.id),
            false
        )

        try {
            await deletePublication(publicationToDelete)
            mutate()
            pushToast({
                message: 'Publicación eliminada',
                description: `"${publicationToDelete.listing?.title || 'Publicación'}" eliminada correctamente.`,
                type: 'success',
            })
            setDeleteModalOpen(false)
        } catch (error: any) {
            console.error(error)
            mutate()
            pushToast({
                message: 'Error al eliminar',
                description: error.message || 'No se pudo eliminar la publicación.',
                type: 'error',
            })
        } finally {
            setIsDeleting(false)
            setPublicationToDelete(null)
        }
    }, [publicationToDelete, mutate, pushToast])

    const handleBulkDeleteClick = () => {
        const selected: Publication[] = (data ?? []).filter((p: Publication) => selectedIds.includes(p.id))
        if (selected.length === 0) return
        setPublicationsToDelete(selected)
        setBulkDeleteModalOpen(true)
    }

    const handleConfirmBulkDelete = useCallback(() => {
        if (publicationsToDelete.length === 0) return

        const idsToDelete = new Set(publicationsToDelete.map(p => p.id))
        mutate(
            (current: Publication[] | undefined) => (current ?? []).filter(p => !idsToDelete.has(p.id)),
            false
        )

        setSelectedIds([])
        tableRef.current?.resetSelection()
        setBulkDeleteModalOpen(false)

        clear()

        enqueue('deletePublication', publicationsToDelete, {}, (p: Publication) => p.listing?.title || 'Publicación')
        setShowQueue(true)
        setPublicationsToDelete([])
    }, [publicationsToDelete, mutate, enqueue])

    // Columnas
    const columns = useMemo(
        () => createColumns(handleDeleteClick, handleEditClick),
        [handleDeleteClick, handleEditClick]
    )

    if (isLoading) return <div className="p-4 text-gray-500">Cargando...</div>
    if (error) return <div className="p-4 text-red-500">Error cargando publicaciones</div>

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
                <div className="mt-3 flex justify-between items-center bg-blue-50 p-3 rounded-md gap-2">
                    <span className="text-sm text-gray-700">{selectedIds.length} seleccionados</span>
                    <div className="flex gap-2">
                        <button
                            onClick={handleBulkDeleteClick}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                        >
                            Eliminar seleccionados
                        </button>
                    </div>
                </div>
            )}

            {/* Modal individual */}
            <DeletePublicationModal
                open={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false)
                    setPublicationToDelete(null)
                }}
                onConfirm={handleConfirmDelete}
                publicationTitle={publicationToDelete?.listing?.title}
                platform={publicationToDelete?.platform}
                isLoading={isDeleting}
                accountId={publicationToDelete?.account_id}
            />

            {/* Modal masivo */}
            <BulkDeletePublicationModal
                open={bulkDeleteModalOpen}
                onClose={() => {
                    setBulkDeleteModalOpen(false)
                    setPublicationsToDelete([])
                }}
                onConfirm={handleConfirmBulkDelete}
                publications={publicationsToDelete}
                isLoading={false}
            />

            {/* Modal de edicion */}
            <EditPublicationModal
                open={editModalOpen}
                onClose={() => {
                    setEditModalOpen(false)
                    setPublicationToEdit(null)
                }}
                onUpdated={() => mutate()}
                publication={publicationToEdit}
            />
        </div>
    )
}