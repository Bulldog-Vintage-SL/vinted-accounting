"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  searchVintedAccount,
  searchWallapopAccount,
  searchVestiaireAccount,
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md relative">
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
            <div className="grid grid-cols-1 gap-3">
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
                onClick={() => handleSelect("shopify")}
                icon="/icons/shopify.svg"
                label="Shopify"
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
}: {
  disabled: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  loading?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
    >
      <img src={icon} alt={label} className="w-10 h-10 object-contain" />
      <span className="text-lg font-medium text-gray-900 flex-1 text-left">{label}</span>
      {loading && <Loader2 className="h-5 w-5 animate-spin text-gray-400" />}
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
    return {
      ok: false,
      message: "Plataforma no soportada",
    }
  }

  return {
    ok: false,
    message: "Plataforma no soportada",
  };
}
