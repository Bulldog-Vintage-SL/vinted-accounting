"use client"

import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from "react"
import { ToastRenderer } from "./ToastRenderer"

interface Toast {
  id: string
  message: string
  description?: string
  type?: "success" | "error" | "info" | "upload"
  duration?: number
  exiting?: boolean
}

export type { Toast }

export const TOAST_EXIT_DURATION_MS = 400
export const DEFAULT_TOAST_DURATION_MS = 12000

interface ToastContextType {
  pushToast: (toast: Omit<Toast, "id">) => void
  dismissToast: (id: string) => void
  pauseToasts: (ids: string[]) => void
  resumeToasts: (ids: string[]) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

interface TimerMeta {
  remaining: number
  startedAt: number
  timers: ReturnType<typeof setTimeout>[]
  paused: boolean
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const metaRef = useRef<Map<string, TimerMeta>>(new Map())

  const clearTimersFor = useCallback((id: string) => {
    const meta = metaRef.current.get(id)
    if (meta) meta.timers.forEach(clearTimeout)
  }, [])

  const scheduleTimers = useCallback((id: string, remaining: number) => {
    const exitTimer = setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    }, Math.max(0, remaining - TOAST_EXIT_DURATION_MS))

    const removalTimer = setTimeout(() => {
      metaRef.current.delete(id)
      setToasts(prev => prev.filter(t => t.id !== id))
    }, remaining)

    metaRef.current.set(id, {
      remaining,
      startedAt: Date.now(),
      timers: [exitTimer, removalTimer],
      paused: false,
    })
  }, [])

  const dismissToast = useCallback((id: string) => {
    clearTimersFor(id)
    metaRef.current.delete(id)
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, TOAST_EXIT_DURATION_MS)
  }, [clearTimersFor])

  const pushToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = crypto.randomUUID()
    const duration = toast.duration ?? DEFAULT_TOAST_DURATION_MS

    setToasts(prev => [...prev, { ...toast, id }])
    scheduleTimers(id, duration)
  }, [scheduleTimers])

  const pauseToasts = useCallback((ids: string[]) => {
    for (const id of ids) {
      const meta = metaRef.current.get(id)
      if (!meta || meta.paused) continue
      meta.timers.forEach(clearTimeout)
      const elapsed = Date.now() - meta.startedAt
      meta.remaining = Math.max(0, meta.remaining - elapsed)
      meta.timers = []
      meta.paused = true
    }
  }, [])

  const resumeToasts = useCallback((ids: string[]) => {
    for (const id of ids) {
      const meta = metaRef.current.get(id)
      if (!meta || !meta.paused) continue
      scheduleTimers(id, meta.remaining)
    }
  }, [scheduleTimers])

  useEffect(() => {
    const metaMap = metaRef.current
    return () => {
      metaMap.forEach(meta => meta.timers.forEach(clearTimeout))
      metaMap.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={{ pushToast, dismissToast, pauseToasts, resumeToasts }}>
      {children}
      <ToastRenderer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>")
  return ctx
}