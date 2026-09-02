"use client";

import Link from "next/link";
import { Loader2, Send, Trash2, BadgeCheck } from "lucide-react";
import type { Listing } from "@/app/inventory/listings/types";
import { formatListingStatus, listingStatusClass } from "@/libs/inventory/display";
import { PlatformLogos } from "@/app/inventory/components/platform-logos";

interface Props {
  listing: Listing;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onPublish: (listing: Listing) => void;
  onMarkSold: (listing: Listing) => void;
  onDelete: (id: string) => void;
  isPublishing: boolean;
}

export function ListingMobileCard({
  listing,
  selected,
  onSelect,
  onPublish,
  onMarkSold,
  onDelete,
  isPublishing,
}: Props) {
  const photo = listing.photo_url?.[0];
  const isSold = listing.status === "sold";

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(listing.id, e.target.checked)}
          className="mt-1 shrink-0"
          aria-label={`Seleccionar ${listing.title}`}
        />

        {photo ? (
          <img
            src={photo}
            alt={listing.title}
            className="h-12 w-12 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="h-12 w-12 shrink-0 rounded-lg bg-gray-100" />
        )}

        <div className="min-w-0 flex-1">
          <Link
            href={`/inventory/listings/${listing.id}`}
            className="line-clamp-2 font-semibold text-blue-600 hover:underline"
          >
            {listing.title}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span className="font-medium tabular-nums">€{Number(listing.price).toFixed(2)}</span>
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${listingStatusClass(listing.status)}`}>
              {formatListingStatus(listing.status)}
            </span>
          </div>
          <div className="mt-2">
            <PlatformLogos platforms={listing.platforms ?? []} />
          </div>
          <p className="mt-1 truncate text-xs text-gray-500">
            SKU: {listing.sku || "—"} · {listing.condition || "—"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {!isSold && (
          <button
            onClick={() => onMarkSold(listing)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-700"
            aria-label="Marcar como vendido"
          >
            <BadgeCheck size={18} />
          </button>
        )}
        <button
          onClick={() => onPublish(listing)}
          disabled={isPublishing || isSold}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {isPublishing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          Publicar
        </button>
        <button
          onClick={() => onDelete(listing.id)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 font-medium text-white transition hover:bg-red-600"
          aria-label="Eliminar producto"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </article>
  );
}
