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
import { ReuploadPublicationModal } from './ReuploadPublicationModal'
import ReuploadPublicationProgressModal from './ReuploadPublicationProgressModal'
import { isUploadFailure } from '@/lib/external-integrations/validators'
import { useToast } from '@/components/toast'
import { useQueue } from '@/hooks/useQueue'
import { PageLoader } from '@/components/ui/page-loader'
import { LoadingButton } from '@/components/ui/loading-button'
import { deleteVintedItem, deleteWallapopItem, deleteVestiaireItem, deleteDepopItem } from '@/lib/external-integrations/'
import { reuploadVintedItem, reuploadWallapopItem, reuploadVestiaireItem, reuploadDepopItem } from '@/lib/external-integrations/'
import { MissingFieldsError } from '@/lib/external-integrations/validators'
import { PublicationMobileCard } from './PublicationMobileCard'
import { TablePagination } from '@/components/ui/table-pagination'
import { INVENTORY_PAGE_SIZE, useClientPagination } from '@/hooks/useClientPagination'
import type { Job } from '@/lib/queue/types'
import type { Listing } from '../../listings/types'

const fetcher = (url: string) => fetch(url).then(res => res.json()).then(res => res.data)

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

    } else if (publication.platform === 'depop') {
        const result = await deleteDepopItem(publication.external_id, publication.id);
        if (!result.ok) throw new Error(result.message);

    } else if (publication.platform === 'ebay') {
        const res = await fetch('/api/ebay/delete-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicationId: publication.id }),
        })
        const data = await res.json()
        if (!res.ok || !data?.ok) {
            throw new Error(`eBay: ${data?.error || 'Error desconocido'}`)
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

async function reuploadPublication(publication: Publication): Promise<void> {

    const res = await fetch(`/api/listings/${publication.listing_id}`);
    if (!res.ok) {
        throw new Error('No se pudo cargar el producto para la resubida');
    }
    const listing: Listing = await res.json();

    if (publication.platform === 'vinted') {
        const result = await reuploadVintedItem(
            publication.account_id,
            listing,
            publication.external_id,
            publication.id
        );
        if (isUploadFailure(result)) {
            if (result.missingFields?.length) {
                const labels = result.missingFields.map(f => f.label).join(', ');
                throw new Error(`Faltan campos: ${labels}`);
            }
            throw new Error(result.message);
        }
    } else if (publication.platform === 'wallapop') {
        const result = await reuploadWallapopItem(
            publication.account_id,
            listing,
            publication.external_id,
            publication.id
        );
        if (isUploadFailure(result)) {
            if (result.missingFields?.length) {
                const labels = result.missingFields.map(f => f.label).join(', ');
                throw new Error(`Faltan campos: ${labels}`);
            }
            throw new Error(result.message);
        }
    } else if (publication.platform === 'vestiaire') {
        const result = await reuploadVestiaireItem(
            publication.account_id,
            listing,
            publication.external_id,
            publication.id
        );
        if (isUploadFailure(result)) {
            if (result.missingFields?.length) {
                const labels = result.missingFields.map(f => f.label).join(', ');
                throw new Error(`Faltan campos: ${labels}`);
            }
            throw new Error(result.message);
        }
    } else if (publication.platform === 'depop') {
        const result = await reuploadDepopItem(
            publication.account_id,
            listing,
            publication.external_id,
            publication.id
        );
        if (isUploadFailure(result)) {
            if (result.missingFields?.length) {
                const labels = result.missingFields.map(f => f.label).join(', ');
                throw new Error(`Faltan campos: ${labels}`);
            }
            throw new Error(result.message);
        }
    }
    else {
        throw new Error(`Resubida no soportada para la plataforma "${publication.platform}"`);
    }
}

export function PublicationsTable() {
    const { data, error, isLoading, mutate } = useSWR<Publication[]>('/api/publications', fetcher, {
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
    const [isSingleReuploading, setIsSingleReuploading] = useState(false)

    // Modal de progreso bloqueante para borrado masivo
    const [deletePhase, setDeletePhase] = useState<'idle' | 'deleting' | 'done'>('idle')
    const [bulkDeleteActive, setBulkDeleteActive] = useState(false)
    const deleteJobsRef = useRef<Job<'deletePublication', Publication>[]>([])

    // Modal de progreso bloqueante para resubida masiva
    // (bulkReuploadModalOpen controla el modal en AMBAS fases: sincronización previa y progreso)
    const [reuploadPhase, setReuploadPhase] = useState<'idle' | 'reuploading' | 'done'>('idle')
    const [bulkReuploadActive, setBulkReuploadActive] = useState(false)
    const [bulkReuploadModalOpen, setBulkReuploadModalOpen] = useState(false)
    const [publicationsToReupload, setPublicationsToReupload] = useState<Publication[]>([])
    const reuploadJobsRef = useRef<Job<'reuploadPublication', Publication>[]>([])

    const [, forceTick] = useState(0)

    useEffect(() => {
        if (!bulkDeleteActive) return

        const allDone = stats.total > 0
            && stats.pending === 0
            && stats.processing === 0
            && stats.retrying === 0

        if (allDone && deletePhase !== 'idle') {
            setDeletePhase('done')
        }
    }, [stats, deletePhase, bulkDeleteActive])

    useEffect(() => {
        if (!bulkReuploadActive) return

        const allDone = stats.total > 0
            && stats.pending === 0
            && stats.processing === 0
            && stats.retrying === 0

        if (allDone && reuploadPhase !== 'idle') {
            setReuploadPhase('done')
        }
    }, [stats, reuploadPhase, bulkReuploadActive])

    useEffect(() => {
        return onDrained(() => {
            tableRef.current?.resetSelection()
            setSelectedIds([])
            setShowQueue(false)
            setDeletePhase('idle')
            setBulkDeleteActive(false)
            deleteJobsRef.current = []
            setReuploadPhase('idle')
            setBulkReuploadActive(false)
            setBulkReuploadModalOpen(false)
            reuploadJobsRef.current = []
            clear()
        })
    }, [onDrained, clear])

    // Suscripción a eventos para forzar re-render del modal
    useEffect(() => {
        if (deletePhase === 'idle' && reuploadPhase === 'idle') return

        const unsubscribe = onEvent(() => {
            forceTick(t => t + 1)
        })

        return unsubscribe
    }, [deletePhase, reuploadPhase, onEvent])

    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [publicationToDelete, setPublicationToDelete] = useState<Publication | null>(null)
    const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)
    const [publicationsToDelete, setPublicationsToDelete] = useState<Publication[]>([])
    const [editModalOpen, setEditModalOpen] = useState(false)
    const [publicationToEdit, setPublicationToEdit] = useState<Publication | null>(null)

    // Modal de confirmación de resubida individual
    const [reuploadModalOpen, setReuploadModalOpen] = useState(false)
    const [publicationToReupload, setPublicationToReupload] = useState<Publication | null>(null)

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

    const handleReuploadClick = useCallback((id: string) => {
        const publication = (data ?? []).find((p: Publication) => p.id === id)
        if (publication) {
            setPublicationToReupload(publication)
            setReuploadModalOpen(true)
        }
    }, [data])

    const handleConfirmReupload = useCallback(async () => {
        if (!publicationToReupload) return

        setIsSingleReuploading(true)

        try {
            await reuploadPublication(publicationToReupload)
            mutate()
            pushToast({
                message: 'Publicación resubida',
                description: `"${publicationToReupload.listing?.title || 'Publicación'}" resubida correctamente.`,
                type: 'success',
            })
            setReuploadModalOpen(false)
        } catch (error: any) {
            console.error(error)
            pushToast({
                message: 'Error al resubir',
                description: error.message || 'No se pudo resubir la publicación.',
                type: 'error',
            })
        } finally {
            setIsSingleReuploading(false)
            setPublicationToReupload(null)
        }
    }, [publicationToReupload, mutate, pushToast])

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
        setBulkDeleteActive(true)
        setDeletePhase('deleting')
        setShowQueue(true)

        setBulkDeleteModalOpen(false)
        setPublicationsToDelete([])
        setIsBulkDeleting(false)
    }, [publicationsToDelete, mutate, enqueue, clear])

    // Solo abre el modal (fase de sincronización de cuentas); no encola nada todavía
    const handleBulkReuploadClick = useCallback(() => {
        const selected: Publication[] = (data ?? []).filter((p: Publication) => selectedIds.includes(p.id))
        if (selected.length === 0) return
        setPublicationsToReupload(selected)
        setBulkReuploadModalOpen(true)
    }, [selectedIds, data])

    // Se dispara desde onConfirm del modal, una vez las cuentas están sincronizadas
    const handleConfirmBulkReupload = useCallback(() => {
        if (publicationsToReupload.length === 0) return

        setSelectedIds([])
        tableRef.current?.resetSelection()

        clear()

        const jobs = enqueue('reuploadPublication', publicationsToReupload, {}, (p: Publication) => p.listing?.title || 'Publicación')
        reuploadJobsRef.current = jobs
        setBulkReuploadActive(true)
        setReuploadPhase('reuploading')
        setShowQueue(true)

        setPublicationsToReupload([])
    }, [publicationsToReupload, enqueue, clear])

    const handleRetryJob = useCallback((job: Job<'deletePublication', Publication>) => {
        if (retryJob) {
            retryJob(job)
        } else {
            retryFailed()
        }
    }, [retryJob, retryFailed])

    const handleRetryReuploadJob = useCallback((job: Job<'reuploadPublication', Publication>) => {
        if (retryJob) {
            retryJob(job)
        } else {
            retryFailed()
        }
    }, [retryJob, retryFailed])

    const handleCloseDeleteProgress = useCallback(() => {
        setDeletePhase('idle')
        setBulkDeleteActive(false)
        deleteJobsRef.current = []
        setShowQueue(false)
        clear() // igual que en onDrained: si el usuario cierra tras errores
        // parciales, no dejar jobs viejos colgados en la cola global
    }, [clear])

    // Cierra el modal tanto si el usuario cancela en la fase de sincronización
    // como si cierra tras terminar (o fallar) la resubida
    const handleCloseReuploadProgress = useCallback(() => {
        setReuploadPhase('idle')
        setBulkReuploadActive(false)
        reuploadJobsRef.current = []
        setPublicationsToReupload([])
        setBulkReuploadModalOpen(false)
        setShowQueue(false)
        clear()
    }, [clear])

    const columns = useMemo(
        () => createColumns(handleDeleteClick, handleEditClick, handleReuploadClick),
        [handleDeleteClick, handleEditClick, handleReuploadClick]
    )

    const handleMobileSelect = useCallback((id: string, checked: boolean) => {
        setSelectedIds((prev) => {
            if (checked) return prev.includes(id) ? prev : [...prev, id]
            return prev.filter((itemId) => itemId !== id)
        })
    }, [])

    const publications = Array.isArray(data) ? data : []
    const {
        page,
        setPage,
        pageItems,
        totalPages,
        from,
        to,
        total,
    } = useClientPagination<Publication>(publications, INVENTORY_PAGE_SIZE)

    useEffect(() => {
        setSelectedIds([])
        tableRef.current?.resetSelection()
    }, [page])

    if (isLoading) return <PageLoader label="Cargando publicaciones..." />
    if (error) return <div className="p-4 text-red-500">Error cargando publicaciones</div>

    return (
        <div className="w-full">
            <div className="hidden md:block">
                <DataTable
                    key={page}
                    ref={tableRef}
                    columns={columns}
                    data={pageItems}
                    onSelectionChange={setSelectedIds}
                    compact
                />
            </div>

            <div className="md:hidden space-y-3">
                {pageItems.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">Sin resultados.</p>
                ) : (
                    pageItems.map((publication) => (
                        <PublicationMobileCard
                            key={publication.id}
                            publication={publication}
                            selected={selectedIds.includes(publication.id)}
                            onSelect={handleMobileSelect}
                            onEdit={handleEditClick}
                            onDelete={handleDeleteClick}
                            onReupload={handleReuploadClick}
                        />
                    ))
                )}
            </div>

            <TablePagination
                page={page}
                totalPages={totalPages}
                from={from}
                to={to}
                total={total}
                noun="publicaciones"
                onPageChange={setPage}
            />

            {selectedIds.length > 0 && (
                <div className="mt-3 flex flex-col sm:flex-row sm:justify-between sm:items-center bg-blue-50 p-3 rounded-md gap-3">
                    <span className="text-sm text-gray-700">{selectedIds.length} seleccionados</span>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <LoadingButton
                            onClick={handleBulkReuploadClick}
                            loading={bulkReuploadActive}
                            loadingText="Resubiendo..."
                            disabled={deletePhase !== 'idle'}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm w-full sm:w-auto"
                        >
                            Resubir seleccionados
                        </LoadingButton>
                        <LoadingButton
                            onClick={handleBulkDeleteClick}
                            loading={isBulkDeleting}
                            loadingText="Eliminando..."
                            disabled={reuploadPhase !== 'idle' || bulkReuploadModalOpen}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-sm w-full sm:w-auto"
                        >
                            Eliminar seleccionados
                        </LoadingButton>
                    </div>
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

            <ReuploadPublicationModal
                open={reuploadModalOpen}
                onClose={() => {
                    setReuploadModalOpen(false)
                    setPublicationToReupload(null)
                }}
                onConfirm={handleConfirmReupload}
                publicationTitle={publicationToReupload?.listing?.title}
                platform={publicationToReupload?.platform}
                isLoading={isSingleReuploading}
                accountId={publicationToReupload?.account_id}
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

            <ReuploadPublicationProgressModal
                open={bulkReuploadModalOpen}
                publications={publicationsToReupload}
                jobs={reuploadJobsRef.current}
                isBusy={reuploadPhase === 'reuploading'}
                onClose={handleCloseReuploadProgress}
                onConfirm={handleConfirmBulkReupload}
                title="Resubiendo publicaciones..."
                onRetryJob={handleRetryReuploadJob}
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