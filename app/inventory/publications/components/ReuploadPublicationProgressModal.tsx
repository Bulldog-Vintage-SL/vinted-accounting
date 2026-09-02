'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, RefreshCw } from "lucide-react"
import type { Job, JobStatus } from '@/lib/queue/types'

interface Props<T> {
  open: boolean
  jobs: Job<'reuploadPublication', T>[]
  isBusy: boolean
  onClose: () => void
  title?: string
  onRetryJob?: (job: Job<'reuploadPublication', T>) => void
}

function ReuploadPublicationProgressModal<T>({ open, jobs, isBusy, onClose, title, onRetryJob }: Props<T>) {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)

  const hasPendingOrActiveJob = jobs.some(
    (job) => job.status === 'pending' || job.status === 'processing' || job.status === 'retrying'
  )
  const allFailed = jobs.length > 0 && jobs.every((job) => job.status === 'failed')
  const blockClose = (isBusy || hasPendingOrActiveJob) && !allFailed

  const failedCount = jobs.filter((j) => j.status === 'failed').length
  const completedCount = jobs.filter((j) => j.status === 'completed').length

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && blockClose) return
    if (!nextOpen) onClose()
  }

  const toggleExpanded = (jobId: string) => {
    setExpandedJobId((current) => (current === jobId ? null : jobId))
  }

  const getSummaryTitle = () => {
    if (blockClose) return title ?? 'Resubiendo publicaciones...'
    if (allFailed) return 'No se pudo resubir ninguna publicación'
    if (failedCount > 0) return 'Resubida completada con errores'
    return '¡Publicaciones resubidas!'
  }

  const getSummarySubtitle = () => {
    if (blockClose) return 'No cierres esta ventana mientras se resuben tus publicaciones.'
    if (allFailed) return 'Revisa los errores de cada publicación o cierra esta ventana.'
    if (failedCount > 0) return `${completedCount} resubida(s), ${failedCount} con error.`
    return 'Ya puedes cerrar esta ventana.'
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="!max-w-[600px] w-full p-8 rounded-2xl max-h-[90vh] flex flex-col"
        onPointerDownOutside={(e) => { if (blockClose) e.preventDefault() }}
        onEscapeKeyDown={(e) => { if (blockClose) e.preventDefault() }}
        showCloseButton={!blockClose}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-2xl font-bold text-gray-800 mb-1">
            {getSummaryTitle()}
          </DialogTitle>
          <p className="text-gray-600 text-sm mb-6">
            {getSummarySubtitle()}
          </p>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {jobs.map((job) => {
            const errorMessage = (job as any).error ?? (job as any).message
            const isExpandable = job.status === 'failed' && !!errorMessage
            const isExpanded = expandedJobId === job.id

            return (
              <div key={job.id} className="border border-gray-200 rounded-xl overflow-hidden">
                <div
                  className={`flex items-center justify-between px-4 py-3 ${isExpandable ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                  onClick={() => isExpandable && toggleExpanded(job.id)}
                >
                  <span className="text-gray-800 font-medium">{job.entityLabel}</span>
                  <div className="flex items-center gap-2">
                    <JobStatusBadge status={job.status} />
                    {isExpandable && (
                      isExpanded
                        ? <ChevronUp size={18} className="text-gray-400" />
                        : <ChevronDown size={18} className="text-gray-400" />
                    )}
                  </div>
                </div>

                {isExpandable && isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                    <p className="text-sm text-gray-600 mb-3">
                      Motivo del error:{' '}
                      <span className="font-medium text-gray-800">{errorMessage}</span>
                    </p>

                    {onRetryJob && (
                      <button
                        onClick={() => {
                          onRetryJob(job)
                          setExpandedJobId(null)
                        }}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
                      >
                        <RefreshCw size={14} />
                        Reintentar
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {!blockClose && (
          <button
            onClick={onClose}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 mt-6 self-start shrink-0"
          >
            Cerrar
          </button>
        )}
      </DialogContent>
    </Dialog>
  )
}

function JobStatusBadge({ status }: { status: JobStatus }) {
  switch (status) {
    case 'completed':
      return <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium"><CheckCircle2 size={18} /> Resubido</span>
    case 'failed':
      return <span className="flex items-center gap-1.5 text-red-600 text-sm font-medium"><XCircle size={18} /> Error</span>
    case 'processing':
      return <span className="flex items-center gap-1.5 text-blue-600 text-sm font-medium"><Loader2 size={18} className="animate-spin" /> Resubiendo...</span>
    case 'retrying':
      return <span className="flex items-center gap-1.5 text-amber-600 text-sm font-medium"><Loader2 size={18} className="animate-spin" /> Reintentando...</span>
    default:
      return <span className="text-gray-400 text-sm font-medium">En cola</span>
  }
}

export default ReuploadPublicationProgressModal