"use client"

import { useState, useEffect } from "react"
import type { ReactElement } from "react"
import { useToast, type Toast } from "./ToastContext"

type ToastType = NonNullable<Toast["type"]>

const typeConfig: Record<ToastType, { border: string; iconBg: string; iconColor: string; dot: string; icon: ReactElement }> = {
  success: {
    border: "border-l-green-500",
    iconBg: "bg-green-50",
    iconColor: "text-green-600",
    dot: "bg-green-500",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7 7a1 1 0 01-1.4 0l-3-3a1 1 0 111.4-1.4L8.3 11.6l6.3-6.3a1 1 0 011.4 0z" clipRule="evenodd" />
      </svg>
    ),
  },
  error: {
    border: "border-l-red-500",
    iconBg: "bg-red-50",
    iconColor: "text-red-600",
    dot: "bg-red-500",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M10 8.6l4.2-4.2a1 1 0 111.4 1.4L11.4 10l4.2 4.2a1 1 0 11-1.4 1.4L10 11.4l-4.2 4.2a1 1 0 01-1.4-1.4L8.6 10 4.4 5.8a1 1 0 011.4-1.4L10 8.6z" clipRule="evenodd" />
      </svg>
    ),
  },
  info: {
    border: "border-l-blue-500",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    dot: "bg-blue-500",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-9a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1zm1 3a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
  },
  upload: {
    border: "border-l-purple-500",
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
    dot: "bg-purple-500",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M10 3a1 1 0 01.7.3l4 4a1 1 0 01-1.4 1.4L11 6.4V13a1 1 0 11-2 0V6.4L6.7 8.7a1 1 0 01-1.4-1.4l4-4A1 1 0 0110 3zM4 15a1 1 0 011 1v.5c0 .3.2.5.5.5h9a.5.5 0 00.5-.5V16a1 1 0 112 0v.5a2.5 2.5 0 01-2.5 2.5h-9A2.5 2.5 0 013 16.5V16a1 1 0 011-1z" />
      </svg>
    ),
  },
}

const STACK_THRESHOLD = 3

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const config = typeConfig[toast.type ?? "info"]

  return (
    <div
      role="status"
      className={`
        relative flex gap-3 pl-4 pr-8 py-3 rounded-xl shadow-lg text-sm
        bg-white border border-gray-200 border-l-4 ${config.border}
        ${toast.exiting ? "toast-exit" : "toast-enter"}
        toast-stack-move
      `}
    >
      <span className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-full mt-0.5 ${config.iconBg} ${config.iconColor}`}>
        {config.icon}
      </span>

      <div className="min-w-0">
        <span className="font-medium text-gray-900">{toast.message}</span>
        {toast.description && (
          <p className="mt-0.5 text-xs text-gray-500">{toast.description}</p>
        )}
      </div>

      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Cerrar notificación"
        className="absolute top-2.5 right-2.5 text-gray-400 hover:text-gray-600 text-lg leading-none"
      >
        ×
      </button>
    </div>
  )
}

function ToastScrollStyles() {
  return (
    <style>{`
      .toast-scroll {
        scrollbar-width: thin;
        scrollbar-color: #d1d5db transparent;
      }
      .toast-scroll::-webkit-scrollbar {
        width: 6px;
      }
      .toast-scroll::-webkit-scrollbar-track {
        background: transparent;
      }
      .toast-scroll::-webkit-scrollbar-thumb {
        background-color: #d1d5db;
        border-radius: 9999px;
      }
      .toast-scroll::-webkit-scrollbar-thumb:hover {
        background-color: #9ca3af;
      }
    `}</style>
  )
}

export function ToastRenderer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[]
  onDismiss: (id: string) => void
}) {
  const { pauseToasts, resumeToasts } = useToast()
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (toasts.length < STACK_THRESHOLD) setExpanded(false)
  }, [toasts.length])

  const shouldStack = toasts.length >= STACK_THRESHOLD
  const ids = toasts.map(t => t.id)
  const idsKey = ids.join(",")

  useEffect(() => {
    if (shouldStack && expanded) {
      pauseToasts(ids)
    } else {
      resumeToasts(ids)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, expanded, shouldStack, pauseToasts, resumeToasts])

  if (toasts.length === 0) return null

  if (!shouldStack) {
    return (
      <div
        className="fixed top-4 right-4 z-[100] flex flex-col gap-3 w-[340px]"
        style={{ pointerEvents: "auto" }}
        aria-live="polite"
      >
        {toasts.map(toast => (
          <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
    )
  }

  const counts = toasts.reduce<Partial<Record<ToastType, number>>>((acc, t) => {
    const key = (t.type ?? "info") as ToastType
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const latest = toasts[toasts.length - 1]
  const latestConfig = typeConfig[latest.type ?? "info"]

  return (
    <div
      className="fixed top-4 right-4 z-[100] flex flex-col items-end gap-2 w-[340px]"
      style={{ pointerEvents: "auto" }}
      aria-live="polite"
    >
      <ToastScrollStyles />

      <button
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        className="flex items-center gap-3 pl-4 pr-3 py-3 rounded-xl shadow-lg text-sm bg-white border border-gray-200 border-l-4 border-l-gray-300 hover:bg-gray-50 transition-colors w-full text-left"
      >
        <span className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-full ${latestConfig.iconBg} ${latestConfig.iconColor}`}>
          {latestConfig.icon}
        </span>

        <div className="min-w-0 flex-1">
          <span className="font-medium text-gray-900">{toasts.length} notificaciones</span>
          <div className="flex items-center gap-2 mt-1">
            {(Object.entries(counts) as [ToastType, number][]).map(([type, count]) => (
              <span key={type} className="flex items-center gap-1 text-xs text-gray-500">
                <span className={`w-1.5 h-1.5 rounded-full ${typeConfig[type].dot}`} />
                {count}
              </span>
            ))}
          </div>
        </div>

        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        >
          <path fillRule="evenodd" d="M5.2 7.5a1 1 0 011.4 0L10 10.9l3.4-3.4a1 1 0 111.4 1.4l-4.1 4.1a1 1 0 01-1.4 0L5.2 8.9a1 1 0 010-1.4z" clipRule="evenodd" />
        </svg>
      </button>

      {expanded && (
        <div className="toast-scroll flex flex-col gap-2.5 w-full max-h-[65vh] overflow-y-auto overflow-x-hidden pr-1.5">
          {[...toasts].reverse().map(toast => (
            <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
          ))}
        </div>
      )}
    </div>
  )
}