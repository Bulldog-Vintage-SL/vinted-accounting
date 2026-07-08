"use client"

import { Dispatch, SetStateAction } from "react"
import type { Toast } from "./ToastContext"

export function ToastRenderer({
  toasts,
  setToasts
}: {
  toasts: Toast[]
  setToasts: Dispatch<SetStateAction<Toast[]>>
}) {

  const closeToast = (id: string) => {
    setToasts(prev =>
      prev.map(t => t.id === id ? { ...t, exiting: true } : t)
    )
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 400)
  }

  const typeColors: Record<string, string> = {
    success: "bg-green-600",
    error: "bg-red-600",
    info: "bg-blue-600",
    upload: "bg-purple-600"
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`
            relative px-5 py-4 rounded-xl shadow-xl text-sm font-medium text-white
            ${typeColors[toast.type ?? "info"]} backdrop-blur-md
            ${toast.exiting ? "toast-exit" : "toast-enter"}
            toast-stack-move
          `}
        >
          <span>{toast.message}</span>
          {toast.description && (
            <p className="mt-1 text-xs font-normal text-white/80">{toast.description}</p>
          )}

          <button
            onClick={() => closeToast(toast.id)}
            className="absolute top-2 right-2 text-white/80 hover:text-white text-lg leading-none"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}