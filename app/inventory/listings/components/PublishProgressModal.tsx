/*
  Modal de progreso bloqueante para la publicación (individual o masiva)
  de productos. Muestra cada job de la cola y su estado, y no deja cerrar
  el modal hasta que todos los jobs han terminado (completed o failed).
*/

'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"
import type { Job, JobStatus } from '@/lib/queue/types'

interface Props<T> {
  open: boolean
  jobs: Job<'upload', T>[]
  isBusy: boolean
  onClose: () => void
  title?: string
}

export function PublishProgressModal<T>({ open, jobs, isBusy, onClose, title }: Props<T>) {

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isBusy) return
    if (!nextOpen) onClose()
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

        <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto pr-1">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3"
            >
              <span className="text-gray-800 font-medium">
                {job.entityLabel}
              </span>
              <JobStatusBadge status={job.status} />
            </div>
          ))}
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

function JobStatusBadge({ status }: { status: JobStatus }) {
  switch (status) {
    case 'completed':
      return (
        <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
          <CheckCircle2 size={18} /> Completado
        </span>
      )
    case 'failed':
      return (
        <span className="flex items-center gap-1.5 text-red-600 text-sm font-medium">
          <XCircle size={18} /> Error
        </span>
      )
    case 'processing':
      return (
        <span className="flex items-center gap-1.5 text-blue-600 text-sm font-medium">
          <Loader2 size={18} className="animate-spin" /> Publicando...
        </span>
      )
    case 'retrying':
      return (
        <span className="flex items-center gap-1.5 text-amber-600 text-sm font-medium">
          <Loader2 size={18} className="animate-spin" /> Reintentando...
        </span>
      )
    default:
      return (
        <span className="text-gray-400 text-sm font-medium">
          En cola
        </span>
      )
  }
}