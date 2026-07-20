"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Publication } from '../types';
import { Trash2, Pencil } from "lucide-react";
import {
  formatPublicationStatus,
  formatSyncStatus,
  publicationStatusClass,
  syncStatusClass,
} from "@/libs/inventory/display";

const PLATFORM_NAMES: Record<string, string> = {
  vinted: "Vinted",
  wallapop: "Wallapop",
  vestiaire: "Vestiaire Collective",
  ebay: "eBay",
  shopify: "Shopify",
};

const PLATFORM_ICONS: Record<string, string> = {
  vinted: "/icons/vinted.svg",
  wallapop: "/icons/wallapop.svg",
  vestiaire: "/icons/vestiaire.jpeg",
  ebay: "/icons/ebay.svg",
  shopify: "/icons/shopify.svg",
};

export const createColumns = (
  onDelete: (id: string) => void,
  onEdit: (id: string) => void
): ColumnDef<Publication>[] => [

    {
      id: "select",
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 32,
      meta: {
        headerClassName: 'w-8',
        cellClassName: 'w-8',
      },
    },

    {
      accessorKey: "listing.photo",
      header: "Foto",
      meta: {
        headerClassName: 'w-[72px]',
        cellClassName: 'w-[72px]',
      },
      cell: ({ row }) => {
        const listing = row.original.listing;
        if (!listing?.photo_url?.[0]) {
          return <div className="w-16 h-16 rounded-md bg-gray-200 border shrink-0" />;
        }
        return (
          <img
            src={listing.photo_url[0]}
            alt={listing.title || 'Producto'}
            className="w-16 h-16 rounded-md object-cover border shrink-0"
          />
        );
      },
    },

    {
      accessorKey: "listing.title",
      header: "Producto",
      meta: {
        headerClassName: 'w-[20%] max-w-[160px]',
        cellClassName: 'w-[20%] max-w-[160px]',
      },
      cell: ({ row }) => {
        const listing = row.original.listing;
        const url = row.original.publication_url;
        const title = listing?.title;

        if (!title) return <span className="text-gray-400">—</span>;

        const content = (
          <span className="block truncate font-medium" title={title}>
            {title}
          </span>
        );

        if (!url) return content;

        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-blue-600 hover:underline hover:text-blue-800 transition"
            title={title}
          >
            {title}
          </a>
        );
      },
    },

    {
      accessorKey: "platform",
      header: "Plat.",
      meta: {
        headerClassName: 'w-10',
        cellClassName: 'w-10',
      },
      cell: ({ row }) => {
        const platform = row.getValue("platform") as string;
        const label = PLATFORM_NAMES[platform] || platform;
        const icon = PLATFORM_ICONS[platform];

        if (!icon) {
          return (
            <span className="block truncate text-[10px] font-semibold text-gray-700" title={label}>
              {label.slice(0, 3)}
            </span>
          );
        }

        return (
          <img
            src={icon}
            alt={label}
            title={label}
            className="w-7 h-7 rounded-md object-contain"
          />
        );
      },
    },

    {
      accessorKey: "status",
      header: "Estado",
      meta: {
        headerClassName: 'w-[9%]',
        cellClassName: 'w-[9%]',
      },
      cell: ({ row }) => {
        const status = row.original.status;
        const label = formatPublicationStatus(status);
        return (
          <span
            className={`inline-block px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${publicationStatusClass(status)}`}
            title={label}
          >
            {label}
          </span>
        );
      },
    },

    {
      accessorKey: "price",
      header: "Precio",
      meta: {
        headerClassName: 'w-[8%]',
        cellClassName: 'w-[8%]',
      },
      cell: ({ row }) => {
        const price = parseFloat(row.getValue('price'));
        return <span className="tabular-nums">€{price.toFixed(2)}</span>;
      },
    },

    {
      accessorKey: "sync_status",
      header: "Sync",
      meta: {
        headerClassName: 'w-[8%] max-w-[72px]',
        cellClassName: 'w-[8%] max-w-[72px]',
      },
      cell: ({ row }) => {
        const sync = row.original.sync_status;
        const label = formatSyncStatus(sync);
        return (
          <span
            className={`inline-block px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${syncStatusClass(sync)}`}
            title={label}
          >
            {label}
          </span>
        );
      },
    },

    {
      accessorKey: "last_sync",
      header: "Actualizado",
      meta: {
        headerClassName: 'w-[12%]',
        cellClassName: 'w-[12%]',
      },
      cell: ({ row }) => {
        const date = row.getValue("last_sync") as string | null;
        if (!date) return '—';
        return (
          <span className="text-gray-600 tabular-nums">
            {new Date(date).toLocaleDateString('es-ES', {
              day: '2-digit',
              month: 'short',
              year: '2-digit',
            })}
          </span>
        );
      },
    },

    {
      id: "actions",
      header: "",
      meta: {
        headerClassName: 'w-24',
        cellClassName: 'w-24',
      },
      cell: ({ row, isHovered }: any) => {
        return (
          <div className="flex justify-end">
            <div className={`flex gap-1.5 transition-opacity opacity-100 md:opacity-0 md:group-hover:opacity-100 ${isHovered ? 'md:opacity-100' : ''}`}>
              <button
                onClick={() => onEdit(row.original.id)}
                className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg shadow transition"
                title="Editar publicación"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => onDelete(row.original.id)}
                className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg shadow transition"
                title="Eliminar publicación"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        );
      },
    },
  ];
