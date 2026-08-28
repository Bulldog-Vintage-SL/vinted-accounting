"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BadgeCheck, Loader2, AlertTriangle } from "lucide-react";
import type { Listing } from "@/app/inventory/listings/types";
import { formatPlatformName } from "@/libs/inventory/display";

interface PublicationOption {
  id: string;
  platform: string;
  status: string;
  price: number | null;
}

interface Props {
  open: boolean;
  listing: Listing | null;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    publicationId: string | null;
    platform: string;
    salePrice: number;
    saleDate: string;
    purchasePrice: number;
  }) => void;
}

const FALLBACK_PLATFORMS = [
  "vinted",
  "wallapop",
  "vestiaire",
  "depop",
  "ebay",
  "shopify",
  "manual",
];

function todayInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export function MarkSoldModal({
  open,
  listing,
  isLoading = false,
  onClose,
  onConfirm,
}: Props) {
  const [loadingContext, setLoadingContext] = useState(false);
  const [publications, setPublications] = useState<PublicationOption[]>([]);
  const [alreadySold, setAlreadySold] = useState(false);
  const [selectedPublicationId, setSelectedPublicationId] = useState("");
  const [platform, setPlatform] = useState("manual");
  const [salePrice, setSalePrice] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [saleDate, setSaleDate] = useState(todayInputValue());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !listing) return;

    let cancelled = false;
    setError(null);
    setAlreadySold(listing.status === "sold");
    setSalePrice(listing.price ? String(listing.price) : "");
    setPurchasePrice("");
    setSaleDate(todayInputValue());
    setSelectedPublicationId("");
    setPlatform("manual");
    setPublications([]);
    setLoadingContext(true);

    fetch(`/api/listings/${listing.id}/mark-sold`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || "No se pudieron cargar las publicaciones");
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        const pubs: PublicationOption[] = data.publications ?? [];
        setPublications(pubs);
        setAlreadySold(Boolean(data.alreadySold));
        if (pubs.length === 1) {
          setSelectedPublicationId(pubs[0].id);
          setPlatform(pubs[0].platform);
          if (pubs[0].price) setSalePrice(String(pubs[0].price));
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Error cargando el producto");
      })
      .finally(() => {
        if (!cancelled) setLoadingContext(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, listing]);

  const handlePublicationChange = (value: string) => {
    setSelectedPublicationId(value);
    if (!value) {
      setPlatform("manual");
      return;
    }
    const pub = publications.find((p) => p.id === value);
    if (pub) {
      setPlatform(pub.platform);
      if (pub.price) setSalePrice(String(pub.price));
    }
  };

  const handleSubmit = () => {
    const price = Number(salePrice);
    if (Number.isNaN(price) || price < 0) {
      setError("Introduce un precio de venta válido");
      return;
    }
    const cost = purchasePrice === "" ? 0 : Number(purchasePrice);
    if (Number.isNaN(cost) || cost < 0) {
      setError("El coste no puede ser negativo");
      return;
    }
    if (!saleDate) {
      setError("La fecha de venta es obligatoria");
      return;
    }

    onConfirm({
      publicationId: selectedPublicationId || null,
      platform,
      salePrice: price,
      saleDate,
      purchasePrice: cost,
    });
  };

  const disableActions = isLoading || loadingContext || alreadySold;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isLoading) onClose();
      }}
    >
      <DialogContent className="!max-w-[520px] w-full p-0 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 text-emerald-700 p-2.5 rounded-xl">
                <BadgeCheck size={22} />
              </div>
              <DialogTitle className="text-xl font-bold text-gray-800">
                Marcar como vendido
              </DialogTitle>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {listing && (
            <p className="text-sm font-medium text-gray-500">
              Producto:{" "}
              <span className="text-gray-800 font-semibold">&ldquo;{listing.title}&rdquo;</span>
            </p>
          )}

          {alreadySold && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700">
              Este producto ya está marcado como vendido.
            </div>
          )}

          {loadingContext ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
              <Loader2 size={16} className="animate-spin" />
              Cargando publicaciones...
            </div>
          ) : (
            <>
              {publications.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600">Vendido en</label>
                  <select
                    value={selectedPublicationId}
                    onChange={(e) => handlePublicationChange(e.target.value)}
                    disabled={disableActions}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Otra / manual</option>
                    {publications.map((pub) => (
                      <option key={pub.id} value={pub.id}>
                        {formatPlatformName(pub.platform)}
                        {pub.price != null ? ` · €${Number(pub.price).toFixed(2)}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600">Plataforma</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    disabled={disableActions}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {FALLBACK_PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {formatPlatformName(p)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {publications.length > 0 && !selectedPublicationId && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600">Plataforma (si no hay publicación)</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    disabled={disableActions}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {FALLBACK_PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {formatPlatformName(p)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600">Precio de venta (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    disabled={disableActions}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600">Coste (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    disabled={disableActions}
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">Fecha de venta</label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  disabled={disableActions}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800 leading-relaxed">
              Se crea la venta y el producto pasa a <span className="font-semibold">vendido</span>.
              Las publicaciones en Relist se marcan como cerradas, pero{" "}
              <span className="font-semibold">los anuncios en las tiendas siguen activos</span> hasta
              que los retires en Publicaciones.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-6 pb-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition text-sm disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={disableActions}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg shadow-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 size={15} className="animate-spin" /> : <BadgeCheck size={15} />}
            {isLoading ? "Guardando..." : "Marcar vendido"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
