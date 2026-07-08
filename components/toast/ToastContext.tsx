"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"
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

interface ToastContextType {
  pushToast: (toast: Omit<Toast, "id">) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const pushToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = crypto.randomUUID()

    setToasts(prev => [...prev, { ...toast, id }])

    const duration = toast.duration ?? 5000

    setTimeout(() => {
      setToasts(prev =>
        prev.map(t => t.id === id ? { ...t, exiting: true } : t)
      )
    }, duration - 500)

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <ToastRenderer toasts={toasts} setToasts={setToasts} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>")
  return ctx
}