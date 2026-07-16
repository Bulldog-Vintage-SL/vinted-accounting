'use client'
/*
  Hook para usar la cola en componentes React.
  Singleton global: misma instancia para toda la app.
*/

import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { Queue } from '@/lib/queue/Queue'
import type { QueueEvent, JobAction, ActionPayload } from '@/lib/queue/types'


let globalQueue: Queue<any> | null = null
let globalListenerRegistered = false

const eventListeners = new Set<(event: QueueEvent) => void>()

// Estado de pausa compartido entre todas las instancias del hook
let isPausedGlobal = false
const pauseListeners = new Set<(paused: boolean) => void>()

function setPausedGlobal(paused: boolean) {
  isPausedGlobal = paused
  pauseListeners.forEach(l => l(paused))
}

function getQueue<T>(): Queue<T> {
  if (!globalQueue) {
    globalQueue = new Queue<T>({
      concurrency: 3,
      delayBetweenJobs: 2000,
      platformDelays: {
        vinted: { upload: 8000 },
        wallapop: { upload: 3000 },
        vestiaire: { upload: 6000, import: 1000 },
        shopify: { upload: 0 },
      },
      noRateLimitActions: ['delete'],
    })
    isPausedGlobal = globalQueue.isPaused
  }

  if (!globalListenerRegistered) {
    globalQueue.on((event) => eventListeners.forEach(cb => cb(event)))
    globalListenerRegistered = true
  }

  return globalQueue
}

export function useQueue<T = unknown>() {
  const queue = useRef(getQueue<T>()).current

  const getStats = useCallback(() => {
    const all = queue.getAllJobs()
    const total = all.length
    const completed = all.filter(j => j.status === 'completed').length
    const failed = all.filter(j => j.status === 'failed').length

    return {
      total,
      pending: all.filter(j => j.status === 'pending').length,
      processing: all.filter(j => j.status === 'processing').length,
      completed,
      failed,
      retrying: all.filter(j => j.status === 'retrying').length,
      progress: total > 0 ? Math.round(((completed + failed) / total) * 100) : 0,
    }
  }, [queue])

  const [stats, setStats] = useState(getStats)
  const [isPaused, setIsPaused] = useState(isPausedGlobal)

  useEffect(() => {
    const unsubscribeStats = queue.on(() => {
      setStats(getStats())
    })

    const onPauseChange = (paused: boolean) => setIsPaused(paused)
    pauseListeners.add(onPauseChange)

    return () => {
      unsubscribeStats()
      pauseListeners.delete(onPauseChange)
    }
  }, [queue, getStats])

  const enqueue = useCallback(<A extends JobAction>(
    action: A,
    entities: T[],
    payload: ActionPayload[A],
    getLabel: (entity: T) => string,
  ) => {
    const jobs = queue.enqueue(action, entities, payload, getLabel)
    setStats(getStats())
    return jobs
  }, [queue, getStats])

  const clear = useCallback(() => {
    queue.clear()
    setStats(getStats())
  }, [queue, getStats])

  const pause = useCallback(() => {
    queue.pause()
    setPausedGlobal(true)
  }, [queue])

  const resume = useCallback(() => {
    queue.resume()
    setPausedGlobal(false)
  }, [queue])

  const retryFailed = useCallback(() => {
    const failed = queue.getAllJobs().filter(j => j.status === 'failed')
    queue.retryJobs(failed)
    setStats(getStats())
  }, [queue, getStats])

  const onDrained = useCallback((cb: () => void) => {
    return queue.on((event) => {
      if (event.type === 'queue:drained') cb()
    })
  }, [queue])

  const onEvent = useCallback((cb: (event: QueueEvent) => void) => {
    eventListeners.add(cb)
    return () => { eventListeners.delete(cb) }
  }, [])

  // Ajustes de delay en caliente, por si necesitas exponer un panel
  // de configuración (ritmo por plataforma/acción).
  const setPlatformDelay = useCallback((platform: string, action: JobAction, ms: number | undefined) => {
    queue.setPlatformActionDelay(platform, action, ms)
  }, [queue])

  const setActionDelay = useCallback((action: JobAction, ms: number | undefined) => {
    queue.setActionDelay(action, ms)
  }, [queue])

  const setNoRateLimit = useCallback((action: JobAction, exempt: boolean = true) => {
    queue.setNoRateLimit(action, exempt)
  }, [queue])

  const setConcurrency = useCallback((n: number) => {
    queue.setConcurrency(n)
  }, [queue])

  const retryJobWithPatch = useCallback((jobId: string, updater: (entity: T) => T) => {
    queue.retryJobWithPatch(jobId, updater)
    setStats(getStats())
  }, [queue, getStats])

  return useMemo(() => ({
    enqueue,
    stats,
    isPaused,
    pause,
    clear,
    resume,
    retryFailed,
    onDrained,
    onEvent,
    retryJobWithPatch,
    setPlatformDelay,
    setActionDelay,
    setNoRateLimit,
    setConcurrency,
  }), [
    enqueue, stats, isPaused, pause, clear, resume, retryFailed,
    onDrained, onEvent, setPlatformDelay, setActionDelay, setNoRateLimit, setConcurrency,
  ])
}