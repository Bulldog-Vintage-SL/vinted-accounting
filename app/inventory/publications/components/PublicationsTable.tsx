'use client'

import useSWR from 'swr'
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { DataTable, DataTableHandle } from '@/components/ui/data-table'
import { createColumns } from './columns'
import { Publication } from '../types'
import { DeletePublicationModal } from './DeletePublicationModal'
import { BulkDeletePublicationModal } from './BulkDeletePublicationModal'
import { EditPublicationModal } from './EditPublicationModal'
import DeletePublicationProgressModal from './DeletePublicationProgressModal'
import { useToast } from '@/components/toast'
import { useQueue } from '@/hooks/useQueue'
import { PageLoader } from '@/components/ui/page-loader'
import { LoadingButton } from '@/components/ui/loading-button'
import { deleteVintedItem, deleteWallapopItem, deleteVestiaireItem, deleteDepopItem } from '@/lib/external-integrations/'
import { PublicationMobileCard } from './PublicationMobileCard'
import type { Job } from '@/lib/queue/types'

const fetcher = (url: string) => fetch(url).then(res => res.json()).then(res => res.data)

async function deletePublication(publication: Publication): Promise<void> {
    // ... igual que antes
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

    const {
        enqueue,
        clear,
        stats,
        jobs,
        isPaused,
        pause,
        resume,
        retryFailed,
        retryJob,
        onDrained,
        onEvent,
    } = useQueue<Publication>()

    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [showQueue, setShowQueue] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isBulkDeleting, setIsBulkDeleting] = useState(false)

    // Modal de progreso bloqueante para borrado masivo
    const [deletePhase, setDeletePhase] = useState<'idle' | 'deleting' | 'done'>('idle')
    const deleteJobsRef = useRef<Job<'deletePublication', Publication>[]>([])
    const [, forceTick] = useState(0)

    useEffect(() => {
        if (stats.total > 0) {
            setShowQueue(true)
            if (deletePhase === 'idle') setDeletePhase('deleting')
        }
    }, [stats.total, deletePhase])

    useEffect(() => {
        const allDone = stats.total > 0
            && stats.pending === 0
            && stats.processing === 0
            && stats.retrying === 0

        if (allDone && deletePhase !== 'idle') {
            setDeletePhase('done')
        }
    }, [stats, deletePhase])

    useEffect(() => {
        return onDrained(() => {
            tableRef.current?.resetSelection()
            setSelectedIds([])
            setShowQueue(false)
            setDeletePhase('idle')
            deleteJobsRef.current = []
        })
    }, [onDrained])

    // Suscripción a eventos para forzar re-render del modal
    useEffect(() => {
        if (deletePhase === 'idle') return

        const unsubscribe = onEvent(() => {
            forceTick(t => t + 1)
        })

        return unsubscribe
    }, [deletePhase, onEvent])

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

        setIsBulkDeleting(true)

        const idsToDelete = new Set(publicationsToDelete.map(p => p.id))
        mutate(
            (current: Publication[] | undefined) => (current ?? []).filter(p => !idsToDelete.has(p.id)),
            false
        )

        setSelectedIds([])
        tableRef.current?.resetSelection()

        clear()

        const jobs = enqueue('deletePublication', publicationsToDelete, {}, (p: Publication) => p.listing?.title || 'Publicación')
        deleteJobsRef.current = jobs
        setDeletePhase('deleting')
        setShowQueue(true)

        setBulkDeleteModalOpen(false)
        setPublicationsToDelete([])
        setIsBulkDeleting(false)
    }, [publicationsToDelete, mutate, enqueue, clear])

    const handleRetryJob = useCallback((job: Job<'deletePublication', Publication>) => {
        if (retryJob) {
            retryJob(job)
        } else {
            retryFailed()
        }
    }, [retryJob, retryFailed])

    const handleCloseDeleteProgress = useCallback(() => {
        setDeletePhase('idle')
        deleteJobsRef.current = []
        setShowQueue(false)
    }, [])

    const columns = useMemo(
        () => createColumns(handleDeleteClick, handleEditClick),
        [handleDeleteClick, handleEditClick]
    )

    const handleMobileSelect = useCallback((id: string, checked: boolean) => {
        setSelectedIds((prev) => {
            if (checked) return prev.includes(id) ? prev : [...prev, id]
            return prev.filter((itemId) => itemId !== id)
        })
    }, [])

    const publications = data ?? []

    if (isLoading) return <PageLoader label="Cargando publicaciones..." />
    if (error) return <div className="p-4 text-red-500">Error cargando publicaciones</div>

    return (
        <div className="w-full">
            <div className="hidden md:block">
                <DataTable
                    ref={tableRef}
                    columns={columns}
                    data={publications}
                    onSelectionChange={setSelectedIds}
                    compact
                />
            </div>

            <div className="md:hidden space-y-3">
                {publications.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">Sin resultados.</p>
                ) : (
                    publications.map((publication) => (
                        <PublicationMobileCard
                            key={publication.id}
                            publication={publication}
                            selected={selectedIds.includes(publication.id)}
                            onSelect={handleMobileSelect}
                            onEdit={handleEditClick}
                            onDelete={handleDeleteClick}
                        />
                    ))
                )}
            </div>

            {selectedIds.length > 0 && (
                <div className="mt-3 flex flex-col sm:flex-row sm:justify-between sm:items-center bg-blue-50 p-3 rounded-md gap-3">
                    <span className="text-sm text-gray-700">{selectedIds.length} seleccionados</span>
                    <LoadingButton
                        onClick={handleBulkDeleteClick}
                        loading={isBulkDeleting}
                        loadingText="Eliminando..."
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-sm w-full sm:w-auto"
                    >
                        Eliminar seleccionados
                    </LoadingButton>
                </div>
            )}

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

            <BulkDeletePublicationModal
                open={bulkDeleteModalOpen}
                onClose={() => {
                    if (isBulkDeleting) return
                    setBulkDeleteModalOpen(false)
                    setPublicationsToDelete([])
                }}
                onConfirm={handleConfirmBulkDelete}
                publications={publicationsToDelete}
                isLoading={isBulkDeleting}
            />

            <DeletePublicationProgressModal
                open={deletePhase !== 'idle'}
                jobs={deleteJobsRef.current}
                isBusy={deletePhase === 'deleting'}
                onClose={handleCloseDeleteProgress}
                title="Eliminando publicaciones..."
                onRetryJob={handleRetryJob}
            />

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