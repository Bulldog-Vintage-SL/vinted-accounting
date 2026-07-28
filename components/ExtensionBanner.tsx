"use client";

import Link from "next/link";
import { AlertTriangle, ExternalLink } from "lucide-react";
import {
  getExtensionStatusMessage,
  getExtensionStoreUrl,
} from "@/lib/external-integrations/extensionAvailability";
import { useExtensionAvailability } from "@/hooks/useExtensionAvailability";

export default function ExtensionBanner() {
  const status = useExtensionAvailability();

  if (!status || status.available) return null;

  if (status.available === false) {
    const { reason } = status;
    const { title, description } = getExtensionStatusMessage(reason);
    const showInstallLink = reason === "not-installed";

    return (
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
        <div className="mx-auto flex max-w-5xl items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{title}</p>
            <p className="mt-0.5 text-sm text-amber-900/90">{description}</p>
            {showInstallLink && (
              <Link
                href={getExtensionStoreUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-amber-800 underline underline-offset-2 hover:text-amber-950"
              >
                Instalar extensión
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
