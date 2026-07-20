"use client";

import Link from "next/link";
import { Loader2, Send, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Listing } from "@/app/inventory/listings/types";

interface Props {
  listing: Listing;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onPublish: (listing: Listing) => void;
  onDelete: (id: string) => void;
  isPublishing: boolean;
}

export function ListingMobileCard({
  listing,
  selected,
  onSelect,
  onPublish,
  onDelete,
  isPublishing,
}: Props) {
  const photo = listing.photo_url?.[0];

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
            className="w-16 h-16 rounded-lg object-cover shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-gray-100 shrink-0" />
        )}

        <div className="min-w-0 flex-1">
          <Link
            href={`/inventory/listings/${listing.id}`}
            className="font-semibold text-blue-600 hover:underline line-clamp-2"
          >
            {listing.title}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span className="font-medium tabular-nums">€{Number(listing.price).toFixed(2)}</span>
            <Badge variant="default" className="text-xs">{listing.status}</Badge>
          </div>
          <p className="mt-1 text-xs text-gray-500 truncate">
            SKU: {listing.sku || "—"} · {listing.condition || "—"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onPublish(listing)}
          disabled={isPublishing}
          className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-lg font-medium transition disabled:opacity-50"
        >
          {isPublishing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          Publicar
        </button>
        <button
          onClick={() => onDelete(listing.id)}
          className="inline-flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-2.5 px-4 rounded-lg font-medium transition"
          aria-label="Eliminar producto"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </article>
  );
}
