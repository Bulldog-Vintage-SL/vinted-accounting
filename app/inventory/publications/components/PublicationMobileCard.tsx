"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { Publication } from "../types";
import {
  formatPublicationStatus,
  formatSyncStatus,
  publicationStatusClass,
  syncStatusClass,
} from "@/libs/inventory/display";
import { PlatformLogos } from "@/app/inventory/components/platform-logos";

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
            className="h-12 w-12 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="h-12 w-12 shrink-0 rounded-lg bg-gray-100" />
        )}

        <div className="min-w-0 flex-1">
          {publication.publication_url ? (
            <a
              href={publication.publication_url}
              target="_blank"
              rel="noopener noreferrer"
              className="line-clamp-2 font-semibold text-blue-600 hover:underline"
            >
              {title}
            </a>
          ) : (
            <p className="line-clamp-2 font-semibold text-gray-900">{title}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <PlatformLogos platforms={[publication.platform]} />
            <span className="text-sm font-medium tabular-nums">
              €{Number(publication.price ?? 0).toFixed(2)}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${publicationStatusClass(publication.status)}`}>
              {formatPublicationStatus(publication.status)}
            </span>
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${syncStatusClass(publication.sync_status)}`}>
              {formatSyncStatus(publication.sync_status)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onEdit(publication.id)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2.5 font-medium text-white transition hover:bg-blue-600"
        >
          <Pencil size={18} />
          Editar
        </button>
        <button
          onClick={() => onDelete(publication.id)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 font-medium text-white transition hover:bg-red-600"
          aria-label="Eliminar publicación"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </article>
  );
}
