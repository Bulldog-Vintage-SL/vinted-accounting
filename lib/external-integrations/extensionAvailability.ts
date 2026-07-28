"use client";

const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID!;

export type ExtensionUnavailableReason =
  | "mobile"
  | "no-browser-support"
  | "not-installed";

export type ExtensionStatus =
  | { available: true }
  | { available: false; reason: ExtensionUnavailableReason };

declare const chrome: {
  runtime?: {
    sendMessage: (
      extensionId: string,
      message: unknown,
      callback?: (response: unknown) => void
    ) => void;
    lastError?: { message?: string };
  };
};

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export function getExtensionStoreUrl(): string {
  return `https://chrome.google.com/webstore/detail/${EXTENSION_ID}`;
}

export function checkExtensionAvailability(): Promise<ExtensionStatus> {
  if (typeof window === "undefined") {
    return Promise.resolve({ available: false, reason: "no-browser-support" });
  }

  if (isMobileDevice()) {
    return Promise.resolve({ available: false, reason: "mobile" });
  }

  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return Promise.resolve({ available: false, reason: "no-browser-support" });
  }

  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(EXTENSION_ID, { type: "PING" }, () => {
        if (chrome.runtime?.lastError) {
          resolve({ available: false, reason: "not-installed" });
          return;
        }

        resolve({ available: true });
      });
    } catch {
      resolve({ available: false, reason: "not-installed" });
    }
  });
}

export function getExtensionStatusMessage(
  reason: ExtensionUnavailableReason
): { title: string; description: string } {
  switch (reason) {
    case "mobile":
      return {
        title: "Extensión no disponible en móvil",
        description:
          "Publicar y sincronizar en Vinted, Wallapop o Vestiaire requiere la extensión de Chrome en un ordenador.",
      };
    case "no-browser-support":
      return {
        title: "Navegador no compatible",
        description:
          "Usa Google Chrome en un ordenador e instala la extensión de Reventa Libertad para publicar en marketplaces.",
      };
    case "not-installed":
      return {
        title: "Extensión no detectada",
        description:
          "Instala la extensión de Reventa Libertad en Chrome para publicar, sincronizar cuentas e importar tu armario.",
      };
  }
}
