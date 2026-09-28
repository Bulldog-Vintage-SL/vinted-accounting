/*
  Interfaz de funciones para las plataformas que hacen uso de la extension.
  Tiene cada una de las funcionalidades.
*/

"use client"

import {
  checkExtensionAvailability,
  getExtensionStatusMessage,
} from "./extensionAvailability"

const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID!
declare const chrome: any

export function extractErrorMessage(result: any, fallback: string): string {
  const candidates = [
    result?.result?.result?.message,
    result?.result?.error,
    result?.result?.message,
    result?.error?.message,
    result?.error,
    result?.message,
  ]
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return formatExtensionError(value)
    if (value && typeof value === 'object' && typeof value.message === 'string' && value.message.trim()) {
      return formatExtensionError(value.message)
    }
  }
  return fallback
}

function formatExtensionError(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed.status) {
        const body =
          typeof parsed.body === 'string'
            ? parsed.body
            : parsed.body
              ? JSON.stringify(parsed.body)
              : ''
        const detail = body.replace(/\s+/g, ' ').slice(0, 160)
        return detail ? `HTTP ${parsed.status}: ${detail}` : `HTTP ${parsed.status}`
      }
      if (typeof parsed.error === 'string' && parsed.error.trim()) return parsed.error.trim()
    } catch {
      // keep the raw string
    }
  }
  return trimmed.length > 280 ? `${trimmed.slice(0, 280)}…` : trimmed
}

async function getToken(): Promise<string | null> {
  const res = await fetch("/api/extension/token")
  if (!res.ok) return null
  const data = await res.json()
  return data.token ?? null
}

async function syncTokenWithExtension() {
  if (typeof chrome === "undefined" || !chrome.runtime) return
  const token = await getToken()
  if (!token) return
  try {
    chrome.runtime.sendMessage(EXTENSION_ID, { type: "SET_TOKEN", token })
  } catch {
    // Extension may not be installed
  }
}

export async function runFlow(flow: string, payload: any = {}): Promise<any> {
  const availability = await checkExtensionAvailability()
  if (availability.available === false) {
    const { title, description } = getExtensionStatusMessage(availability.reason)
    throw new Error(`${title}. ${description}`)
  }

  await syncTokenWithExtension()

  return new Promise<any>((resolve, reject) => {
    try {
      // Mandamos el workflow al background de la extension, la cual ira pidiendo los steps a la api
      chrome.runtime.sendMessage(
        EXTENSION_ID,
        { type: "RUN_FLOW", flow, payload },
        (response: any) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
            return
          }
          resolve(response)
        }
      )
    } catch (e) {
      console.log(e)
      reject(e)
    }
  })
}
