import { useEffect } from "react"

export function useChromeMessages(onMessage: (msg: any) => void) {
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.data?.source !== "reventa") return
            onMessage(event.data)
        }

        window.addEventListener("message", handler)
        return () => window.removeEventListener("message", handler)
    }, [])
}
