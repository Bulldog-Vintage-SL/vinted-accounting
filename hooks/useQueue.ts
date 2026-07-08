/*
  Hook para usar la cola en componentes React.
  Singleton global: misma instancia para toda la app.
*/

import { useMemo, useState, useCallback, useEffect } from 'react'
import { Queue } from '@/lib/queue/Queue'
import type { QueueEvent, JobAction } from '@/lib/queue/types'

// Instancia global
let globalQueue: Queue<any> | null = null

function getQueue() {
  if (!globalQueue) {
    globalQueue = new Queue({
      concurrency: 2,
      delayBetweenJobs: 2000
    })
  }
  return globalQueue
}

// Desuso: Listeners para React 
const listeners = new Set<() => void>()
function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
function notify() {
  listeners.forEach(l => l())
}

const eventListeners = new Set<(event: QueueEvent) => void>()
getQueue().on((event) => {
  eventListeners.forEach(cb => cb(event))
})


export function useQueue() {
  const queue = getQueue()

  const getStats = () => {
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
  }

  const [stats, setStats] = useState(getStats)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    const unsubscribe = queue.on(() => {
      setStats(getStats())
    })
    return unsubscribe
  }, [])

  const enqueue = useCallback(<A extends JobAction>(
    action: A,
    entities: any[],
    payload: any,
    getLabel: (entity: any) => string,
  ) => {
    const jobs = queue.enqueue(action, entities, payload, getLabel)
    setStats(getStats())
    return jobs
  }, [])
 
  const clear = useCallback(() => {
    queue.clear()
    setStats(getStats())
  }, [])


  const pause = useCallback(() => {
    queue.pause()
    setIsPaused(true)
  }, [])

  const resume = useCallback(() => {
    queue.resume()
    setIsPaused(false)
  }, [])

  const retryFailed = useCallback(() => {
    const failed = queue.getAllJobs().filter(j => j.status === 'failed')
    queue.retryJobs(failed)
    setStats(getStats())
  }, [])

  const onDrained = useCallback((cb: () => void) => {
    return queue.on((event) => {
      if (event.type === 'queue:drained') cb()
    })
  }, [])

  const onEvent = useCallback((cb: (event: QueueEvent) => void) => {
    eventListeners.add(cb)
    return () => { eventListeners.delete(cb) }
  }, [])

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
  }), [enqueue, stats, isPaused, pause, resume, retryFailed, onDrained, onEvent])
}