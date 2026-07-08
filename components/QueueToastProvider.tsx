'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useQueue } from '@/hooks/useQueue'
import { useToast } from '@/components/toast'
import { useSWRConfig } from 'swr'

export function QueueToastProvider({ children }: { children: ReactNode }) {
  const { pushToast } = useToast()
  const { onEvent } = useQueue()
  const { mutate } = useSWRConfig()

  const pushToastRef = useRef(pushToast)
  pushToastRef.current = pushToast

  const mutateRef = useRef(mutate)
  mutateRef.current = mutate

  useEffect(() => {
    return onEvent((event) => {
      if (event.type === 'queue:drained' || event.type === 'queue:updated') return

      const { job } = event

      if (job.action === 'delete' || job.action === 'deletePublication') {
        const endpoint = job.action === 'delete' ? '/api/listings' : '/api/publications'

        if (event.type === 'job:start') {
          pushToastRef.current({
            type: "upload",
            message: `Eliminando: ${job.entityLabel}`,
            duration: 4000
          })
        }
        if (event.type === 'job:success') {
          pushToastRef.current({
            type: "success",
            message: `Eliminado: ${job.entityLabel}`
          })
          mutateRef.current(endpoint)
        }
        if (event.type === 'job:failed') {
          pushToastRef.current({
            type: "error",
            message: `Error al eliminar: ${job.entityLabel} - ${job.error || 'Desconocido'}`
          })
          mutateRef.current(endpoint)
        }
        return
      }

      if (event.type === 'job:start') {
        const label = job.action === 'import'
          ? `Importando: ${job.entityLabel}`
          : `Publicando: ${job.entityLabel}`

        pushToastRef.current({
          type: "upload",
          message: label,
          duration: job.action === 'import' ? 5000 : 6000
        })
      }

      if (event.type === 'job:success') {
        const label = job.action === 'import'
          ? `Importado: ${job.entityLabel}`
          : `Publicado: ${job.entityLabel}`

        pushToastRef.current({
          type: "success",
          message: label
        })
        mutateRef.current('/api/listings')
      }

      if (event.type === 'job:failed') {
        pushToastRef.current({
          type: "error",
          message: `Error: ${job.entityLabel} - ${job.error || 'Desconocido'}`
        })
        mutateRef.current('/api/listings')
      }
    })
  }, [onEvent])

  return <>{children}</>
}