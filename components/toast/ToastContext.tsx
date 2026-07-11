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

interface ToastContextType {
  pushToast: (toast: Omit<Toast, "id">) => void
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>[]>>(new Map())

  const clearTimersFor = useCallback((id: string) => {
    const timers = timersRef.current.get(id)
    if (timers) {
      timers.forEach(clearTimeout)
      timersRef.current.delete(id)
    }
  }, [])

  const dismissToast = useCallback((id: string) => {
    clearTimersFor(id)
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))

    const removalTimer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, TOAST_EXIT_DURATION_MS)

    timersRef.current.set(id, [removalTimer])
  }, [clearTimersFor])

  const pushToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = crypto.randomUUID()
    const duration = toast.duration ?? 5000

    setToasts(prev => [...prev, { ...toast, id }])

    const exitTimer = setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    }, Math.max(0, duration - TOAST_EXIT_DURATION_MS))

    const removalTimer = setTimeout(() => {
      timersRef.current.delete(id)
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)

    timersRef.current.set(id, [exitTimer, removalTimer])
  }, [])

  useEffect(() => {
    const timersMap = timersRef.current
    return () => {
      timersMap.forEach(timers => timers.forEach(clearTimeout))
      timersMap.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={{ pushToast, dismissToast }}>
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