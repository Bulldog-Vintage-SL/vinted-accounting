"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { Publication } from "../types";
import {
  formatPublicationStatus,
  formatSyncStatus,
  publicationStatusClass,
  syncStatusClass,
} from "@/libs/inventory/display";

const PLATFORM_ICONS: Record<string, string> = {
  vinted: "/icons/vinted.svg",
  wallapop: "/icons/wallapop.svg",
  vestiaire: "/icons/vestiaire.jpeg",
  ebay: "/icons/ebay.svg",
  shopify: "/icons/shopify.svg",
};

interface Props {
  publication: Publication;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function PublicationMobileCard({
  publication,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: Props) {
  const listing = publication.listing;
  const photo = listing?.photo_url?.[0];
  const title = listing?.title || "Sin título";
  const platformIcon = PLATFORM_ICONS[publication.platform];

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(publication.id, e.target.checked)}
          className="mt-1 shrink-0"
          aria-label={`Seleccionar ${title}`}
        />

        {photo ? (
          <img
            src={photo}
            alt={title}
            className="w-20 h-20 rounded-lg object-cover border shrink-0"
          />
        ) : (
          <div className="w-20 h-20 rounded-lg bg-gray-100 border shrink-0" />
        )}

        <div className="min-w-0 flex-1">
          {publication.publication_url ? (
            <a
              href={publication.publication_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-blue-600 hover:underline line-clamp-2"
            >
              {title}
            </a>
          ) : (
            <p className="font-semibold text-gray-900 line-clamp-2">{title}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {platformIcon ? (
              <img src={platformIcon} alt={publication.platform} className="w-6 h-6 rounded object-contain" />
            ) : null}
            <span className="text-sm font-medium tabular-nums">
              €{Number(publication.price ?? 0).toFixed(2)}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${publicationStatusClass(publication.status)}`}>
              {formatPublicationStatus(publication.status)}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${syncStatusClass(publication.sync_status)}`}>
              {formatSyncStatus(publication.sync_status)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onEdit(publication.id)}
          className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium transition"
        >
          <Pencil size={18} />
          Editar
        </button>
        <button
          onClick={() => onDelete(publication.id)}
          className="inline-flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-2.5 px-4 rounded-lg font-medium transition"
          aria-label="Eliminar publicación"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </article>
  );
}
