"use client";

import { useEffect, useState } from "react";
import {
  checkExtensionAvailability,
  type ExtensionStatus,
} from "@/lib/external-integrations/extensionAvailability";

export function useExtensionAvailability() {
  const [status, setStatus] = useState<ExtensionStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    checkExtensionAvailability().then((result) => {
      if (!cancelled) setStatus(result);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
