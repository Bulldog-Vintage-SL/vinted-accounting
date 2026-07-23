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

// Listas cerradas 
const COLOR_OPTIONS = [
  "Negro", "Blanco", "Rojo", "Azul", "Verde",
  "Amarillo", "Gris", "Rosa", "Naranja", "Marrón",
]

const SIZE_OPTIONS = [
  "XS", "S", "M", "L", "XL", "XXL", "XXXL",
  "4XL", "5XL", "6XL", "7XL", "8XL", "Talla única",
]

const GENDER_OPTIONS = ["hombre", "mujer", "unisex"]

const CONDITION_OPTIONS = ["Nuevo", "Como nuevo", "Bueno", "Aceptable"]

const MULTI_FIELD_OPTIONS: Record<string, string[]> = {
  color: COLOR_OPTIONS,
  colors: COLOR_OPTIONS,
}

const SINGLE_FIELD_OPTIONS: Record<string, string[]> = {
  size: SIZE_OPTIONS,
  'attributes.size': SIZE_OPTIONS,
  gender: GENDER_OPTIONS,
  condition: CONDITION_OPTIONS,
}

export function PublishProgressModal<T>({ open, jobs, isBusy, onClose, title, onRetryJob }: Props<T>) {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)

  const hasActiveJob = jobs.some((job) => job.status === 'processing' || job.status === 'retrying')
  const blockClose = isBusy || hasActiveJob

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && blockClose) return
    if (!nextOpen) onClose()
  }

  const toggleExpanded = (jobId: string) => {
    setExpandedJobId((current) => (current === jobId ? null : jobId))
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
            {blockClose ? (title ?? 'Publicando productos...') : '¡Publicación completada!'}
          </DialogTitle>
          <p className="text-gray-600 text-sm mb-6">
            {blockClose
              ? 'No cierres esta ventana mientras se publican tus productos.'
              : 'Ya puedes cerrar esta ventana.'}
          </p>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
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

        {!blockClose && (
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 mt-6 self-start shrink-0"
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

  const [multiValues, setMultiValues] = useState<Record<string, string[]>>({})

  const [pendingMultiSelection, setPendingMultiSelection] = useState<Record<string, string>>({})

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const addMultiValue = (key: string) => {
    const selected = pendingMultiSelection[key]
    if (!selected) return

    setMultiValues((prev) => {
      const current = prev[key] ?? []
      if (current.includes(selected)) return prev
      return { ...prev, [key]: [...current, selected] }
    })
    setPendingMultiSelection((prev) => ({ ...prev, [key]: '' }))
  }

  const removeMultiValue = (key: string, option: string) => {
    setMultiValues((prev) => ({
      ...prev,
      [key]: (prev[key] ?? []).filter((v) => v !== option),
    }))
  }

  const allFilled = missingFields.every((f) => {
    if (MULTI_FIELD_OPTIONS[f.key]) return (multiValues[f.key]?.length ?? 0) > 0
    return values[f.key]?.trim()
  })

  const buildPatch = (): Record<string, string> => {
    const patch: Record<string, string> = { ...values }
    for (const key of Object.keys(multiValues)) {
      patch[key] = multiValues[key].join(', ')
    }
    return patch
  }

  return (
    <div className="flex flex-col gap-3">
      {missingFields.map((field) => {
        const multiOptions = MULTI_FIELD_OPTIONS[field.key]
        const singleOptions = SINGLE_FIELD_OPTIONS[field.key]

        if (multiOptions) {
          const selectedValues = multiValues[field.key] ?? []

          return (
            <div key={field.key} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600 capitalize">{field.label}</label>

              <div className="flex gap-2">
                <select
                  value={pendingMultiSelection[field.key] ?? ''}
                  onChange={(e) => setPendingMultiSelection((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecciona {field.label.toLowerCase()}</option>
                  {multiOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => addMultiValue(field.key)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 rounded-lg shrink-0"
                >
                  Añadir
                </button>
              </div>

              {selectedValues.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedValues.map((opt) => (
                    <div key={opt} className="flex items-center gap-1.5 bg-gray-100 border px-2.5 py-1 rounded-full">
                      <span className="text-xs">{opt}</span>
                      <button
                        type="button"
                        onClick={() => removeMultiValue(field.key, opt)}
                        className="text-red-500 font-bold text-xs leading-none"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        }

        return (
          <div key={field.key} className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 capitalize">{field.label}</label>

            {singleOptions ? (
              <select
                value={values[field.key] ?? ''}
                onChange={(e) => handleChange(field.key, e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecciona {field.label.toLowerCase()}</option>
                {singleOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={values[field.key] ?? ''}
                onChange={(e) => handleChange(field.key, e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
        )
      })}

      <div className="flex gap-2 mt-2">
        <button
          onClick={() => onSubmit(buildPatch())}
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