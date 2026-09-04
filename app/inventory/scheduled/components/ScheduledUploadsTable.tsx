'use client'

import useSWR from 'swr'
import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Trash2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { PageLoader } from '@/components/ui/page-loader'
import { useToast } from '@/components/toast'
import { PlatformLogos } from '@/app/inventory/components/platform-logos'
import { TablePagination } from '@/components/ui/table-pagination'
import { INVENTORY_PAGE_SIZE, useClientPagination } from '@/hooks/useClientPagination'
import { CancelScheduledUploadModal } from './CancelScheduledUploadModal'
import { EditScheduledTimeModal } from './EditScheduledTimeModal'
import type { ScheduledUploadJob } from '../types'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

type StatusFilter = 'pending' | 'processing' | 'completed' | 'failed' | 'all'

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'pending', label: 'Programadas' },
  { id: 'processing', label: 'Publicando' },
  { id: 'completed', label: 'Publicadas' },
  { id: 'failed', label: 'Con error' },
  { id: 'all', label: 'Todas' },
]

function StatusBadge({ status }: { status: ScheduledUploadJob['status'] }) {
  switch (status) {
    case 'completed':
      return (
        <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
          <CheckCircle2 size={16} /> Publicado
        </span>
      )
    case 'failed':
      return (
        <span className="flex items-center gap-1.5 text-red-600 text-sm font-medium">
          <XCircle size={16} /> Error
        </span>
      )
    case 'processing':
      return (
        <span className="flex items-center gap-1.5 text-blue-600 text-sm font-medium">
          <Loader2 size={16} className="animate-spin" /> Publicando...
        </span>
      )
    default:
      return (
        <span className="flex items-center gap-1.5 text-gray-500 text-sm font-medium">
          <Clock size={16} /> Programado
        </span>
      )
  }
}

function formatScheduledAt(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ScheduledUploadsTable() {
  const { data, error, isLoading, mutate } = useSWR<ScheduledUploadJob[]>(
    '/api/upload-jobs',
    fetcher,
    {
      refreshInterval: 15000,
      revalidateOnFocus: true,
    }
  )

  const { pushToast } = useToast()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')

  const [editingJob, setEditingJob] = useState<ScheduledUploadJob | null>(null)
  const [isSavingTime, setIsSavingTime] = useState(false)

  const [deletingJob, setDeletingJob] = useState<ScheduledUploadJob | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const allJobs = data ?? []

  const filteredJobs = allJobs.filter((job) =>
    statusFilter === 'all' ? true : job.status === statusFilter
  )

  const {
    page,
    setPage,
    pageItems,
    totalPages,
    from,
    to,
    total,
  } = useClientPagination<ScheduledUploadJob>(filteredJobs, INVENTORY_PAGE_SIZE, statusFilter)

  useEffect(() => {
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const handleConfirmEdit = useCallback(
    async (scheduledAt: Date) => {
      if (!editingJob) return
      setIsSavingTime(true)

      try {
        const res = await fetch(`/api/upload-jobs/${editingJob.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduledAt: scheduledAt.toISOString() }),
        })

        const body = await res.json().catch(() => null)

        if (!res.ok) {
          pushToast({
            message: 'No se pudo reprogramar',
            description: body?.error || 'Inténtalo de nuevo.',
            type: 'error',
          })
          return
        }

        mutate()
        pushToast({
          message: 'Hora actualizada',
          description: `Reprogramado para ${scheduledAt.toLocaleString('es-ES')}.`,
          type: 'success',
        })
        setEditingJob(null)
      } finally {
        setIsSavingTime(false)
      }
    },
    [editingJob, mutate, pushToast]
  )

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingJob) return
    setIsDeleting(true)

    try {
      const res = await fetch(`/api/upload-jobs/${deletingJob.id}`, { method: 'DELETE' })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        pushToast({
          message: 'No se pudo eliminar',
          description: body?.error || 'Inténtalo de nuevo.',
          type: 'error',
        })
        return
      }

      mutate((current) => (current ?? []).filter((j) => j.id !== deletingJob.id), false)
      pushToast({ message: 'Publicación programada eliminada', type: 'success' })
      setDeletingJob(null)
    } finally {
      setIsDeleting(false)
    }
  }, [deletingJob, mutate, pushToast])

  if (isLoading) return <PageLoader label="Cargando publicaciones programadas..." />
  if (error) return <div className="p-4 text-red-500">Error cargando publicaciones programadas</div>

  const deletingJobTitle =
    deletingJob && typeof deletingJob.listingId !== 'string'
      ? deletingJob.listingId.title
      : undefined

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setStatusFilter(filter.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
              statusFilter === filter.id
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {filteredJobs.length === 0 ? (
        <p className="py-8 text-center text-gray-500">
          No hay publicaciones programadas en este estado.
        </p>
      ) : (
        <>
          <div className="hidden md:block overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-2 font-medium">Producto</th>
                  <th className="px-4 py-2 font-medium">Cuentas</th>
                  <th className="px-4 py-2 font-medium">Programado para</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageItems.map((job) => {
                  const listing = typeof job.listingId === 'string' ? null : job.listingId
                  const canEdit = job.status === 'pending'

                  return (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {listing?.photoUrl?.[0] ? (
                            <img
                              src={listing.photoUrl[0]}
                              alt={listing.title}
                              className="h-10 w-10 rounded-md object-cover shrink-0"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-md bg-gray-100 shrink-0" />
                          )}
                          <span className="truncate max-w-[220px] font-medium text-gray-800">
                            {listing?.title ?? 'Producto eliminado'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <PlatformLogos platforms={job.accounts.map((a) => a.platform)} />
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-600">
                        {formatScheduledAt(job.scheduledAt)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={job.status} />
                        {job.status === 'failed' && job.error && (
                          <p className="mt-0.5 max-w-[220px] truncate text-xs text-red-500" title={job.error}>
                            {job.error}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          {canEdit && (
                            <button
                              onClick={() => setEditingJob(job)}
                              className="rounded-lg bg-gray-100 p-2 text-gray-600 shadow-sm transition hover:bg-gray-200"
                              title="Editar hora"
                            >
                              <Pencil size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => setDeletingJob(job)}
                            className="rounded-lg bg-red-500 p-2 text-white shadow-sm transition hover:bg-red-600"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {pageItems.map((job) => {
              const listing = typeof job.listingId === 'string' ? null : job.listingId
              const canEdit = job.status === 'pending'

              return (
                <div key={job.id} className="rounded-xl border border-gray-200 p-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    {listing?.photoUrl?.[0] ? (
                      <img
                        src={listing.photoUrl[0]}
                        alt={listing.title}
                        className="h-12 w-12 rounded-md object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-md bg-gray-100 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-800">
                        {listing?.title ?? 'Producto eliminado'}
                      </p>
                      <div className="mt-0.5">
                        <PlatformLogos platforms={job.accounts.map((a) => a.platform)} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs tabular-nums text-gray-600">
                      {formatScheduledAt(job.scheduledAt)}
                    </span>
                    <StatusBadge status={job.status} />
                  </div>

                  {job.status === 'failed' && job.error && (
                    <p className="mt-1 truncate text-xs text-red-500" title={job.error}>
                      {job.error}
                    </p>
                  )}

                  <div className="mt-3 flex gap-2">
                    {canEdit && (
                      <button
                        onClick={() => setEditingJob(job)}
                        className="flex-1 rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-700"
                      >
                        Editar hora
                      </button>
                    )}
                    <button
                      onClick={() => setDeletingJob(job)}
                      className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-medium text-white"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <TablePagination
            page={page}
            totalPages={totalPages}
            from={from}
            to={to}
            total={total}
            noun="programaciones"
            onPageChange={setPage}
          />
        </>
      )}

      <EditScheduledTimeModal
        open={editingJob !== null}
        job={editingJob}
        isLoading={isSavingTime}
        onClose={() => {
          if (isSavingTime) return
          setEditingJob(null)
        }}
        onConfirm={handleConfirmEdit}
      />

      <CancelScheduledUploadModal
        open={deletingJob !== null}
        onClose={() => {
          if (isDeleting) return
          setDeletingJob(null)
        }}
        onConfirm={handleConfirmDelete}
        listingTitle={deletingJobTitle}
        isLoading={isDeleting}
      />
    </div>
  )
}