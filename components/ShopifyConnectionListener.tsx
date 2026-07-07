"use client";

import { Suspense, useEffect, useRef, type ReactElement } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import toast from "react-hot-toast";

function ShopifyConnectionListenerInner(): null {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const handled = useRef(false);

  useEffect(() => {
    const shopifyStatus = searchParams.get("shopify");
    if (!shopifyStatus || handled.current) return;

    handled.current = true;

    if (shopifyStatus === "connected") {
      toast.success("Tienda de Shopify conectada correctamente");
    } else if (shopifyStatus === "error") {
      const reason = searchParams.get("reason");
      toast.error(
        `No se pudo conectar la tienda de Shopify${reason ? ` (${reason})` : ""}`
      );
    }

    router.replace(pathname);
  }, [searchParams, router, pathname]);

  return null;
}

export function ShopifyConnectionListener(): ReactElement {
  return (
    <Suspense fallback={null}>
      <ShopifyConnectionListenerInner />
    </Suspense>
  );
}
