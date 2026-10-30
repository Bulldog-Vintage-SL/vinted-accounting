"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  searchVintedAccount,
  searchWallapopAccount,
  searchVestiaireAccount,
  searchDepopAccount,
  searchGrailedAccount,
  searchMilanunciosAccount,
  searchFacebookAccount,
  searchTodocoleccionAccount,
  searchOplaAccount,
} from '@/lib/external-integrations';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AddAccountModal({ open, onClose }: Props) {
  const [pending, start] = useTransition();
  const [pendingPlatform, setPendingPlatform] = useState<string | null>(null);
  const [showShopifyInput, setShowShopifyInput] = useState(false);
  const [shopDomain, setShopDomain] = useState("");
  const router = useRouter();

  if (!open) return null;

  const handleSelect = (platform: string) => {
    if (platform === "shopify") {
      setShowShopifyInput(true);
      return;
    }

    if (platform === "ebay") {
      window.location.href = "/api/ebay/install";
      return;
    }

    start(async () => {
      setPendingPlatform(platform);
      try {
        const res = await startAccountSearch(platform);

        if (res?.ok) {
          toast.success(res.message);
        } else {
          toast.error(res?.message ?? "Error desconocido");
        }

        onClose();
        router.refresh();
      } catch (err: any) {
        toast.error(err?.message ?? "Error inesperado");
      } finally {
        setPendingPlatform(null);
      }
    });
  };

  const handleShopifyConnect = () => {
    const cleaned = shopDomain.trim().toLowerCase();
    const normalized = cleaned.includes(".myshopify.com")
      ? cleaned
      : `${cleaned}.myshopify.com`;

    if (!/^[a-zA-Z0-9-]+\.myshopify\.com$/.test(normalized)) {
      toast.error("Dominio de tienda no válido (ej. mi-tienda.myshopify.com)");
      return;
    }

    window.location.href = `/api/shopify/install?shop=${encodeURIComponent(normalized)}`;
  };

  const handleClose = () => {
    setShowShopifyInput(false);
    setShopDomain("");
    setPendingPlatform(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-xl p-4 sm:p-6 w-full max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto relative">
        {pending && (
          <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-2 text-gray-600">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm font-medium">Buscando cuenta...</span>
            </div>
          </div>
        )}

        <h2 className="text-lg font-semibold mb-4 text-center text-gray-900">
          {showShopifyInput ? "Conectar tienda Shopify" : "Selecciona una plataforma"}
        </h2>

        {showShopifyInput ? (
          <div className="flex flex-col gap-3">
            <input
              type="text"
              autoFocus
              placeholder="mi-tienda.myshopify.com"
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleShopifyConnect()}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <button
              onClick={handleShopifyConnect}
              disabled={!shopDomain.trim() || pending}
              className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition disabled:opacity-50 text-sm font-medium inline-flex items-center justify-center gap-2"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Conectar
            </button>
            <button
              onClick={() => setShowShopifyInput(false)}
              className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition text-sm font-medium"
            >
              Volver
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
              <PlatformOption
                disabled={pending}
                loading={pendingPlatform === "vinted"}
                onClick={() => handleSelect("vinted")}
                icon="/icons/vinted.svg"
                label="Vinted"
              />
              <PlatformOption
                disabled={pending}
                loading={pendingPlatform === "wallapop"}
                onClick={() => handleSelect("wallapop")}
                icon="/icons/wallapop.svg"
                label="Wallapop"
              />
              <PlatformOption
                disabled={pending}
                loading={pendingPlatform === "vestiaire"}
                onClick={() => handleSelect("vestiaire")}
                icon="/icons/vestiaire.jpeg"
                label="Vestiaire Collective"
              />
              <PlatformOption
                disabled={pending}
                loading={pendingPlatform === "depop"}
                onClick={() => handleSelect("depop")}
                icon="/icons/depop.jpeg"
                label="Depop"
              />
              <PlatformOption
                disabled={pending}
                loading={pendingPlatform === "grailed"}
                onClick={() => handleSelect("grailed")}
                icon="/icons/grailed.png"
                label="Grailed"
              />
              <PlatformOption
                disabled={pending}
                loading={pendingPlatform === "milanuncios"}
                onClick={() => handleSelect("milanuncios")}
                icon="/icons/milanuncios.png"
                label="Milanuncios"
              />
              <PlatformOption
                disabled={pending}
                loading={pendingPlatform === "facebook"}
                onClick={() => handleSelect("facebook")}
                icon="/icons/facebook.svg"
                label="Facebook Marketplace"
              />
              <PlatformOption
                disabled={pending}
                loading={pendingPlatform === "todocoleccion"}
                onClick={() => handleSelect("todocoleccion")}
                icon="/icons/todocoleccion.png"
                label="todocoleccion"
              />
              <PlatformOption
                disabled={pending}
                loading={pendingPlatform === "opla"}
                onClick={() => handleSelect("opla")}
                icon="/icons/opla.svg"
                label="Opla"
              />
              <PlatformOption
                disabled={pending}
                onClick={() => handleSelect("shopify")}
                icon="/icons/shopify.svg"
                label="Shopify"
              />
              <PlatformOption
                disabled={pending}
                onClick={() => handleSelect("ebay")}
                icon="/icons/ebay.svg"
                label="eBay"
              />
            </div>

            <button
              onClick={handleClose}
              className="mt-5 w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition text-sm font-medium"
            >
              Cancelar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function PlatformOption({
  disabled,
  onClick,
  icon,
  label,
  loading,
  badge,
  className = "",
}: {
  disabled: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  loading?: boolean;
  badge?: string;
  className?: string;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`relative flex w-[calc((100%-0.5rem)/2)] sm:w-[calc((100%-2.25rem)/4)] min-w-0 min-h-[104px] flex-col items-center justify-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 ${className}`}
    >
      <img src={icon} alt={label} className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 object-contain" />
      <span className="w-full break-words text-center text-xs sm:text-sm font-medium leading-tight text-gray-900">
        {label}
      </span>
      {badge && (
        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
          {badge}
        </span>
      )}
      {loading && <Loader2 className="absolute right-2 top-2 h-4 w-4 shrink-0 animate-spin text-gray-400" />}
    </button>
  );
}

async function startAccountSearch(platform: string): Promise<any> {
  if (platform === "vinted") {
    return searchVintedAccount();
  }
  if (platform === "wallapop") {
    return searchWallapopAccount();
  }
  if (platform === "vestiaire") {
    return searchVestiaireAccount();
  }
  if (platform === "depop") {
    return searchDepopAccount();
  }
  if (platform === "grailed") {
    return searchGrailedAccount();
  }
  if (platform === "milanuncios") {
    return searchMilanunciosAccount();
  }
  if (platform === "facebook") {
    return searchFacebookAccount();
  }
  if (platform === "todocoleccion") {
    return searchTodocoleccionAccount();
  }
  if (platform === "opla") {
    return searchOplaAccount();
  }

  return {
    ok: false,
    message: "Plataforma no soportada",
  };
}