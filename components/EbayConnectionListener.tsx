"use client";

import { Suspense, useEffect, useRef, type ReactElement } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import toast from "react-hot-toast";

const ERROR_MESSAGES: Record<string, string> = {
  missing_params: "Faltan parámetros en la respuesta de eBay",
  missing_runame:
    "Falta EBAY_RUNAME en .env.local. Sigue los pasos del banner amarillo en esta página.",
  missing_config: "eBay OAuth no está configurado en el servidor",
  invalid_state:
    "Sesión OAuth inválida. Inicia sesión en Reventa Libertad y vuelve a conectar eBay.",
  expired_state: "La sesión OAuth expiró. Inténtalo de nuevo.",
  token_exchange_failed: "No se pudo intercambiar el código de autorización con eBay",
  invalid_grant: "Código de eBay inválido o expirado. Pulsa Añadir cuenta → eBay otra vez.",
  invalid_client:
    "Credenciales de eBay incorrectas en el servidor. Añade EBAY_* en Vercel.",
  access_denied: "Has cancelado la autorización en eBay",
  ebay_error: "eBay rechazó la autorización",
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

    const finish = () => {
      router.replace(pathname);
      router.refresh();
    };

    if (ebayStatus === "connected") {
      const policies = searchParams.get("policies");
      const accountId = searchParams.get("accountId");

      if (policies === "missing_scope") {
        toast.error(
          "eBay conectado, pero falta el permiso sell.account. En developer.ebay.com activa ese scope en tu app y vuelve a Añadir cuenta → eBay.",
          { duration: 10000 }
        );
        finish();
        return;
      }

      if (accountId && policies === "pending") {
        const toastId = toast.loading(
          "Cuenta conectada. Configurando políticas de vendedor…"
        );

        void (async () => {
          try {
            const res = await fetch("/api/ebay/setup-policies", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ accountId }),
            });
            const data = (await res.json()) as {
              ok?: boolean;
              error?: string;
            };

            if (res.ok && data?.ok) {
              toast.success("Cuenta de eBay conectada y políticas de venta listas", {
                id: toastId,
              });
            } else {
              toast.error(
                data?.error ??
                  "eBay conectado, pero no se pudieron crear las políticas de venta. Pulsa Verificar políticas.",
                { id: toastId, duration: 8000 }
              );
            }
          } catch {
            toast.error(
              "eBay conectado, pero no se pudieron crear las políticas de venta. Pulsa Verificar políticas.",
              { id: toastId, duration: 8000 }
            );
          } finally {
            finish();
          }
        })();
        return;
      }

      toast.success("Cuenta de eBay conectada correctamente");
      finish();
      return;
    }

    if (ebayStatus === "error") {
      const reason = searchParams.get("reason");
      const details = searchParams.get("details");
      const baseMessage =
        ERROR_MESSAGES[reason ?? ""] ??
        `No se pudo conectar la cuenta de eBay${reason ? ` (${reason})` : ""}`;
      toast.error(details ? `${baseMessage}: ${details}` : baseMessage, {
        duration: 8000,
      });
    }

    finish();
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
