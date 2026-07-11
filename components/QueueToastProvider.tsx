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

  const deleteBatchRef = useRef({ succeeded: 0, failed: 0 })

  useEffect(() => {
    return onEvent((event) => {
      if (event.type === 'queue:updated') return

      if (event.type === 'queue:drained') {
        const { succeeded, failed } = deleteBatchRef.current
        if (succeeded > 0 || failed > 0) {
          if (failed === 0) {
            pushToastRef.current({
              type: 'success',
              message: succeeded === 1 ? 'Producto eliminado' : `${succeeded} productos eliminados`,
            })
          } else if (succeeded === 0) {
            pushToastRef.current({
              type: 'error',
              message: failed === 1
                ? 'No se pudo eliminar el producto'
                : `No se pudieron eliminar ${failed} productos`,
            })
          } else {
            pushToastRef.current({
              type: 'error',
              message: `${succeeded} eliminados, ${failed} con error`,
            })
          }
          deleteBatchRef.current = { succeeded: 0, failed: 0 }
        }
        return
      }

      const { job } = event

      if (job.action === 'delete') {
        if (event.type === 'job:success') {
          deleteBatchRef.current.succeeded++
          mutateRef.current('/api/listings')
        }
        if (event.type === 'job:failed') {
          deleteBatchRef.current.failed++
          mutateRef.current('/api/listings')
        }
        return
      }

      if (job.action === 'deletePublication') {
        if (event.type === 'job:start') {
          pushToastRef.current({
            type: 'upload',
            message: `Eliminando: ${job.entityLabel}`,
            duration: 4000,
          })
        }
        if (event.type === 'job:success') {
          pushToastRef.current({
            type: 'success',
            message: `Eliminado: ${job.entityLabel}`,
          })
          mutateRef.current('/api/publications')
        }
        if (event.type === 'job:failed') {
          pushToastRef.current({
            type: 'error',
            message: `Error al eliminar: ${job.entityLabel} - ${job.error || 'Desconocido'}`,
          })
          mutateRef.current('/api/publications')
        }
        return
      }

      // Upload / import
      if (event.type === 'job:start') {
        const label = job.action === 'import'
          ? `Importando: ${job.entityLabel}`
          : `Publicando: ${job.entityLabel}`

        pushToastRef.current({
          type: 'upload',
          message: label,
          duration: job.action === 'import' ? 5000 : 6000,
        })
      }

      if (event.type === 'job:success') {
        const label = job.action === 'import'
          ? `Importado: ${job.entityLabel}`
          : `Publicado: ${job.entityLabel}`

        pushToastRef.current({
          type: 'success',
          message: label,
        })
        mutateRef.current('/api/listings')
      }

      if (event.type === 'job:failed') {
        pushToastRef.current({
          type: 'error',
          message: `Error: ${job.entityLabel} - ${job.error || 'Desconocido'}`,
        })
        mutateRef.current('/api/listings')
      }
    })
  }, [onEvent])

  return <>{children}</>
}