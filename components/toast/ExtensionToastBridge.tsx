/*
  Puente con la extension para crear Toasts cuando terminan determinados workflowd en Vinted/Wallapop.
*/

"use client"
import { useChromeMessages } from "@/hooks/useChromeMessages"
import { useToast } from "@/components/toast"

export function ExtensionToastBridge(): null {
  const { pushToast } = useToast()

  useChromeMessages((msg) => {
    if (msg.type === "PUBLICATION_CREATED") {
      pushToast({
        type: "success",
        message: `Producto ${msg.data?.externalId} publicado correctamente`,
        duration: 30000
      })
    }

    if (msg.type === "ACCOUNT_SYNCED") {
      pushToast({
        type: "info",
        message: "Cuenta sincronizada correctamente",
        duration: 8000
      })
    }

    if (msg.type === "UPLOAD_FAILED") {
      pushToast({
        type: "error",
        message: "Error al subir el producto",
        duration: 10000
      })
    }
  })

  return null
}
