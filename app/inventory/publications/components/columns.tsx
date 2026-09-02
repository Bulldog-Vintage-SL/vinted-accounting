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
import { PlatformLogos } from "@/app/inventory/components/platform-logos";

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
        headerClassName: 'w-16',
        cellClassName: 'w-16',
      },
      cell: ({ row }) => {
        const listing = row.original.listing;
        if (!listing?.photo_url?.[0]) {
          return <div className="h-12 w-12 shrink-0 rounded-md bg-gray-100" />;
        }
        return (
          <img
            src={listing.photo_url[0]}
            alt={listing.title || 'Producto'}
            className="h-12 w-12 shrink-0 rounded-md object-cover"
          />
        );
      },
    },

    {
      accessorKey: "listing.title",
      header: "Producto",
      meta: {
        headerClassName: 'w-[22%] max-w-[180px]',
        cellClassName: 'w-[22%] max-w-[180px]',
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
            className="block truncate font-medium text-blue-600 transition hover:text-blue-800 hover:underline"
            title={title}
          >
            {title}
          </a>
        );
      },
    },

    {
      accessorKey: "platform",
      header: "Plataforma",
      meta: {
        headerClassName: 'w-16',
        cellClassName: 'w-16',
      },
      cell: ({ row }) => (
        <PlatformLogos platforms={[row.original.platform]} size="md" />
      ),
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
            className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ${publicationStatusClass(status)}`}
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
        headerClassName: 'hidden w-[8%] max-w-[72px] lg:table-cell',
        cellClassName: 'hidden w-[8%] max-w-[72px] lg:table-cell',
      },
      cell: ({ row }) => {
        const sync = row.original.sync_status;
        const label = formatSyncStatus(sync);
        return (
          <span
            className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ${syncStatusClass(sync)}`}
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
        headerClassName: 'hidden w-[12%] xl:table-cell',
        cellClassName: 'hidden w-[12%] xl:table-cell',
      },
      cell: ({ row }) => {
        const date = row.getValue("last_sync") as string | null;
        if (!date) return '—';
        return (
          <span className="tabular-nums text-gray-600">
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
      cell: ({ row, isHovered }: { row: { original: Publication }; isHovered?: boolean }) => {
        return (
          <div className="flex justify-end">
            <div className={`flex gap-1.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 ${isHovered ? 'md:opacity-100' : ''}`}>
              <button
                onClick={() => onEdit(row.original.id)}
                className="rounded-lg bg-blue-500 p-2 text-white shadow transition hover:bg-blue-600"
                title="Editar publicación"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => onDelete(row.original.id)}
                className="rounded-lg bg-red-500 p-2 text-white shadow transition hover:bg-red-600"
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
