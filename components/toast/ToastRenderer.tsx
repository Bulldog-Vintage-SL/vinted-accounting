"use client"

import type { ReactElement } from "react"
import type { Toast } from "./ToastContext"

type ToastType = NonNullable<Toast["type"]>

const typeConfig: Record<ToastType, { border: string; iconBg: string; iconColor: string; icon: ReactElement }> = {
  success: {
    border: "border-l-green-500",
    iconBg: "bg-green-50",
    iconColor: "text-green-600",
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
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M10 3a1 1 0 01.7.3l4 4a1 1 0 01-1.4 1.4L11 6.4V13a1 1 0 11-2 0V6.4L6.7 8.7a1 1 0 01-1.4-1.4l4-4A1 1 0 0110 3zM4 15a1 1 0 011 1v.5c0 .3.2.5.5.5h9a.5.5 0 00.5-.5V16a1 1 0 112 0v.5a2.5 2.5 0 01-2.5 2.5h-9A2.5 2.5 0 013 16.5V16a1 1 0 011-1z" />
      </svg>
    ),
  },
}

export function ToastRenderer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[]
  onDismiss: (id: string) => void
}) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3" aria-live="polite">
      {toasts.map(toast => {
        const config = typeConfig[toast.type ?? "info"]

        return (
          <div
            key={toast.id}
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
      })}
    </div>
  )
}