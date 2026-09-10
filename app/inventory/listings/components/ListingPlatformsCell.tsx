"use client";

import { Plus } from "lucide-react";
import type { Listing } from "@/app/inventory/listings/types";
import { PlatformLogos } from "@/app/inventory/components/platform-logos";

interface Props {
  listing: Listing;
  disabled?: boolean;
  onAdd: (listing: Listing) => void;
}

export function ListingPlatformsCell({ listing, disabled, onAdd }: Props) {
  const platforms = listing.platforms ?? [];

  return (
    <div className="flex flex-wrap items-center gap-1">
      {platforms.length > 0 && <PlatformLogos platforms={platforms} />}
      <button
        type="button"
        title="Marcar plataforma publicada"
        aria-label="Marcar plataforma publicada"
        disabled={disabled}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onAdd(listing);
        }}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-dashed border-gray-300 text-gray-500 transition hover:border-gray-400 hover:bg-gray-50 hover:text-gray-800 disabled:cursor-wait disabled:opacity-50"
      >
        <Plus size={14} strokeWidth={2.5} />
      </button>
    </div>
  );
}
