'use client'

import { useMemo, useState } from 'react'
import { Calendar, Clock, X } from 'lucide-react'
import { LoadingButton } from '@/components/ui/loading-button'
import type { ScheduledUploadJob } from '../types'

interface EditScheduledTimeModalProps {
  open: boolean
  job: ScheduledUploadJob | null
  isLoading?: boolean
  onClose: () => void
  onConfirm: (scheduledAt: Date) => void
}

function pad(n: number) {
  return n.toString().padStart(2, '0')
}

function toLocalParts(iso: string) {
  const d = new Date(iso)
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

export function EditScheduledTimeModal({
  open,
  job,
  isLoading = false,
  onClose,
  onConfirm,
}: EditScheduledTimeModalProps) {
  const defaults = useMemo(
    () => (job ? toLocalParts(job.scheduledAt) : { date: '', time: '' }),
    [job]
  )
  const [date, setDate] = useState(defaults.date)
  const [time, setTime] = useState(defaults.time)
  const [error, setError] = useState<string | null>(null)

  useMemo(() => {
    setDate(defaults.date)
    setTime(defaults.time)
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id])

  if (!open || !job) return null

  const today = new Date()
  const minDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

  const listingTitle =
    typeof job.listingId === 'string' ? 'producto' : job.listingId.title

  const handleConfirm = () => {
    if (!date || !time) {
      setError('Elige una fecha y una hora.')
      return
    }

    const scheduledAt = new Date(`${date}T${time}:00`)

    if (Number.isNaN(scheduledAt.getTime())) {
      setError('Fecha u hora no válidas.')
      return
    }

    if (scheduledAt.getTime() <= Date.now()) {
      setError('La fecha y hora deben ser en el futuro.')
      return
    }

    setError(null)
    onConfirm(scheduledAt)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Editar hora de publicación</h2>
            <p className="mt-1 text-sm text-gray-500 truncate max-w-[280px]" title={listingTitle}>
              {listingTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <Calendar className="h-3.5 w-3.5" />
              Fecha
            </label>
            <input
              type="date"
              value={date}
              min={minDate}
              onChange={(e) => setDate(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
            />
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <Clock className="h-3.5 w-3.5" />
              Hora
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancelar
          </button>
          <LoadingButton
            onClick={handleConfirm}
            loading={isLoading}
            loadingText="Guardando..."
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white hover:bg-blue-700"
          >
            Guardar
          </LoadingButton>
        </div>
      </div>
    </div>
  )
}