/*
  Interfaz de funciones para Vinted y Wallapop que hacen uso de la extension.
  Tiene cada una de las funcionalidades. TODO: Subir producto a Wallapop.
*/


"use client"

const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID!
declare const chrome: any

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
  if (typeof chrome === "undefined" || !chrome.runtime) return

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
