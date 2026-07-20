"use client";

import type { ReactNode } from "react";
import {
  CheckCircle,
  Clock,
  Edit,
  FileText,
  Trash2,
  Truck,
} from "lucide-react";
import { SaleItemThumbnail } from "./SaleItemThumbnail";

interface SaleCardProps {
  sale: {
    _id: string;
    transactionId: string;
    itemName: string;
    amount?: number;
    purchasePrice?: number;
    status: "pending" | "completed" | "cancelled";
    shippingCarrier: string;
    shippingDeadline?: string;
    saleDate: string;
    completedDate?: string;
    hasLabel?: boolean;
    itemImageUrl?: string;
    bundleId?: string;
  };
  variant: "pending" | "completed";
  carrierNames: Record<string, string>;
  carrierColors: Record<string, string>;
  formatCurrency: (amount: number) => string;
  formatDate: (dateString: string) => string;
  formatDeadline?: (dateString: string) => ReactNode;
  selected?: boolean;
  onToggleSelect?: () => void;
  onDownloadLabel?: () => void;
  downloadingLabel?: boolean;
  bundles?: Array<{ _id: string; name: string; quantity: number }>;
  linkingBundle?: boolean;
  onLinkBundle?: (bundleId: string | null) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}

export function SaleMobileCard({
  sale,
  variant,
  carrierNames,
  carrierColors,
  formatCurrency,
  formatDate,
  formatDeadline,
  selected,
  onToggleSelect,
  onDownloadLabel,
  downloadingLabel,
  bundles = [],
  linkingBundle,
  onLinkBundle,
  onEdit,
  onDelete,
  deleting,
}: SaleCardProps) {
  const profit = (sale.amount || 0) - (sale.purchasePrice || 0);
  const hasCost = sale.purchasePrice && sale.purchasePrice > 0;
  const displayDate =
    variant === "completed"
      ? sale.completedDate || sale.saleDate
      : sale.saleDate;

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        {variant === "pending" && onToggleSelect ? (
          <input
            type="checkbox"
            className="checkbox checkbox-sm mt-1 shrink-0"
            disabled={!sale.hasLabel}
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Seleccionar ${sale.itemName}`}
          />
        ) : null}

        <SaleItemThumbnail
          itemName={sale.itemName}
          itemImageUrl={sale.itemImageUrl}
          size="sm"
        />

        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 line-clamp-2">{sale.itemName}</p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">#{sale.transactionId}</p>
          <p className="text-xs text-gray-500 mt-1">{formatDate(displayDate)}</p>

          {variant === "pending" ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${carrierColors[sale.shippingCarrier] || carrierColors.unknown}`}
              >
                <Truck className="w-3 h-3" />
                {carrierNames[sale.shippingCarrier] || sale.shippingCarrier}
              </span>
              {sale.shippingDeadline && formatDeadline ? (
                <span className="text-xs">{formatDeadline(sale.shippingDeadline)}</span>
              ) : null}
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-semibold text-gray-900">
                {formatCurrency(sale.amount || 0)}
              </span>
              {hasCost ? (
                <span
                  className={`text-xs font-medium ${profit > 0 ? "text-emerald-600" : "text-red-600"}`}
                >
                  {formatCurrency(profit)}
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
        {variant === "pending" && sale.hasLabel && onDownloadLabel ? (
          <button
            onClick={onDownloadLabel}
            disabled={downloadingLabel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700 disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5" />
            Etiqueta
          </button>
        ) : null}

        {variant === "completed" && onLinkBundle ? (
          <select
            value={sale.bundleId || ""}
            onChange={(e) => onLinkBundle(e.target.value || null)}
            disabled={linkingBundle}
            className={`flex-1 min-w-0 max-w-full text-xs border rounded-lg px-2 py-1.5 focus:outline-none ${sale.bundleId ? "border-blue-200 bg-blue-50 text-blue-700" : "border-gray-200"}`}
          >
            <option value="">Sin vincular</option>
            {bundles
              .filter((bundle) => bundle.quantity > 0 || bundle._id === sale.bundleId)
              .map((bundle) => (
                <option key={bundle._id} value={bundle._id}>
                  {bundle.name} ({bundle.quantity})
                </option>
              ))}
          </select>
        ) : null}

        {variant === "completed" && onEdit ? (
          <button
            onClick={onEdit}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
            aria-label="Editar venta"
          >
            <Edit className="w-4 h-4" />
          </button>
        ) : null}

        {variant === "completed" && onDelete ? (
          <button
            onClick={onDelete}
            disabled={deleting}
            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
            aria-label="Eliminar venta"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ) : null}

        {variant === "pending" ? (
          <span className="inline-flex items-center gap-1 text-xs text-amber-700 ml-auto">
            <Clock className="w-3.5 h-3.5" />
            Pendiente
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 ml-auto">
            <CheckCircle className="w-3.5 h-3.5" />
            Completada
          </span>
        )}
      </div>
    </article>
  );
}
