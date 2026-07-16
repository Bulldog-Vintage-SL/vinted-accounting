'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react"
import type { Job, JobStatus } from '@/lib/queue/types'

interface Props<T> {
  open: boolean
  jobs: Job<'upload', T>[]
  isBusy: boolean
  onClose: () => void
  title?: string
  onRetryJob?: (job: Job<'upload', T>, patch: Record<string, string>) => void
}

export function PublishProgressModal<T>({ open, jobs, isBusy, onClose, title, onRetryJob }: Props<T>) {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isBusy) return
    if (!nextOpen) onClose()
  }

  const toggleExpanded = (jobId: string) => {
    setExpandedJobId((current) => (current === jobId ? null : jobId))
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="!max-w-[600px] w-full p-8 rounded-2xl overflow-hidden"
        onPointerDownOutside={(e) => { if (isBusy) e.preventDefault() }}
        onEscapeKeyDown={(e) => { if (isBusy) e.preventDefault() }}
        showCloseButton={!isBusy}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-800 mb-1">
            {isBusy ? (title ?? 'Publicando productos...') : '¡Publicación completada!'}
          </DialogTitle>
          <p className="text-gray-600 text-sm mb-6">
            {isBusy
              ? 'No cierres esta ventana mientras se publican tus productos.'
              : 'Ya puedes cerrar esta ventana.'}
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto pr-1">
          {jobs.map((job) => {
            const isExpandable = job.status === 'failed' && !!job.missingFields?.length && !!onRetryJob
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

                {isExpandable && isExpanded && job.missingFields && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                    <p className="text-sm text-gray-600 mb-3">
                      Faltan campos para publicar:{' '}
                      <span className="font-medium text-gray-800">
                        {job.missingFields.map(f => f.label).join(', ')}
                      </span>
                    </p>

                    <RetryForm
                      missingFields={job.missingFields}
                      onSubmit={(patch) => {
                        onRetryJob?.(job, patch)
                        setExpandedJobId(null)
                      }}
                      onCancel={() => setExpandedJobId(null)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {!isBusy && (
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 mt-6 self-start"
          >
            Cerrar
          </button>
        )}
      </DialogContent>
    </Dialog>
  )
}

function RetryForm({
  missingFields,
  onSubmit,
  onCancel,
}: {
  missingFields: { key: string; label: string }[]
  onSubmit: (patch: Record<string, string>) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const allFilled = missingFields.every((f) => values[f.key]?.trim())

  return (
    <div className="flex flex-col gap-3">
      {missingFields.map((field) => (
        <div key={field.key} className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 capitalize">{field.label}</label>
          <input
            type="text"
            value={values[field.key] ?? ''}
            onChange={(e) => handleChange(field.key, e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      ))}

      <div className="flex gap-2 mt-2">
        <button
          onClick={() => onSubmit(values)}
          disabled={!allFilled}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
        >
          Reintentar
        </button>
        <button onClick={onCancel} className="text-gray-600 hover:text-gray-800 text-sm font-medium px-4 py-1.5">
          Cancelar
        </button>
      </div>
    </div>
  )
}

function JobStatusBadge({ status }: { status: JobStatus }) {
  switch (status) {
    case 'completed':
      return <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium"><CheckCircle2 size={18} /> Completado</span>
    case 'failed':
      return <span className="flex items-center gap-1.5 text-red-600 text-sm font-medium"><XCircle size={18} /> Error</span>
    case 'processing':
      return <span className="flex items-center gap-1.5 text-blue-600 text-sm font-medium"><Loader2 size={18} className="animate-spin" /> Publicando...</span>
    case 'retrying':
      return <span className="flex items-center gap-1.5 text-amber-600 text-sm font-medium"><Loader2 size={18} className="animate-spin" /> Reintentando...</span>
    default:
      return <span className="text-gray-400 text-sm font-medium">En cola</span>
  }
}