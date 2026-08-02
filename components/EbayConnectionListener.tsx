"use client";

import { Suspense, useEffect, useRef, type ReactElement } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import toast from "react-hot-toast";

const ERROR_MESSAGES: Record<string, string> = {
  missing_params: "Faltan parámetros en la respuesta de eBay",
  missing_runame:
    "Falta EBAY_RUNAME en .env.local. Sigue los pasos del banner amarillo en esta página.",
  missing_config: "eBay OAuth no está configurado en el servidor",
  invalid_state: "Sesión OAuth inválida. Inténtalo de nuevo.",
  expired_state: "La sesión OAuth expiró. Inténtalo de nuevo.",
  token_exchange_failed: "No se pudo intercambiar el código de autorización",
  account_already_linked: "Esta cuenta de eBay ya está vinculada a otro usuario",
};

function EbayConnectionListenerInner(): null {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const handled = useRef(false);

  useEffect(() => {
    const ebayStatus = searchParams.get("ebay");
    if (!ebayStatus || handled.current) return;

    handled.current = true;

    if (ebayStatus === "connected") {
      toast.success("Cuenta de eBay conectada correctamente");
    } else if (ebayStatus === "error") {
      const reason = searchParams.get("reason");
      toast.error(
        ERROR_MESSAGES[reason ?? ""] ??
          `No se pudo conectar la cuenta de eBay${reason ? ` (${reason})` : ""}`
      );
    }

    router.replace(pathname);
  }, [searchParams, router, pathname]);

  return null;
}

export function EbayConnectionListener(): ReactElement {
  return (
    <Suspense fallback={null}>
      <EbayConnectionListenerInner />
    </Suspense>
  );
}
