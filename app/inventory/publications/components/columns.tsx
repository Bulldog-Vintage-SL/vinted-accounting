"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Publication } from '../types';
import { Trash2, Pencil } from "lucide-react";

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

    // Checkbox de seleccion
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
      size: 40,
    },

    // Columna de foto
    {
      accessorKey: "listing.photo",
      header: "",
      cell: ({ row }) => {
        const listing = row.original.listing;
        if (!listing?.photo_url) {
          return <div className="w-12 h-12 rounded-md bg-gray-200 border" />;
        }
        return (
          <img
            src={listing.photo_url[0]}
            alt="foto"
            className="w-12 h-12 rounded-md object-cover border"
          />
        );
      },
    },

    // Producto (titulo con enlace)
    {
      accessorKey: "listing.title",
      header: "Producto",
      cell: ({ row }) => {
        const listing = row.original.listing;
        const url = row.original.publication_url;
        if (!listing?.title) return "—";
        if (!url) return listing.title;
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline hover:text-blue-800 transition"
          >
            {listing.title}
          </a>
        );
      },
    },
    {
      accessorKey: "platform",
      header: "Plataforma",
      cell: ({ row }) => {
        const platform = row.getValue("platform") as string;
        const label = PLATFORM_NAMES[platform] || platform;
        const icon = PLATFORM_ICONS[platform];

        if (!icon) {
          return (
            <span className="px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-700">
              {label}
            </span>
          );
        }

        return (
          <img
            src={icon}
            alt={label}
            title={label}
            className="w-6 h-6 rounded-md object-contain"
          />
        );
      },
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <span
            className={`
            px-2 py-1 rounded-md text-xs font-semibold
            ${status === "active"
                ? "bg-green-100 text-green-700"
                : "bg-gray-200 text-gray-700"
              }
          `}
          >
            {status}
          </span>
        );
      },
    },
    {
      accessorKey: "price",
      header: "Precio",
      cell: ({ row }) => {
        const price = parseFloat(row.getValue('price'));
        return <span>€{price.toFixed(2)}</span>;
      },
    },
    {
      accessorKey: "sync_status",
      header: "Sync",
      cell: ({ row }) => {
        const sync = row.getValue("sync_status") as string;
        return (
          <span
            className={`
            px-2 py-1 rounded-md text-xs font-semibold
            ${sync === "pending"
                ? "bg-yellow-100 text-yellow-700"
                : sync === "success"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }
          `}
          >
            {sync}
          </span>
        );
      },
    },
    {
      accessorKey: "last_sync",
      header: "Última Sync",
      cell: ({ row }) => {
        const date = row.getValue("last_sync") as string | null;
        return date ? new Date(date).toLocaleString() : "—";
      },
    },

    // Columna de acciones 
    {
      id: "actions",
      header: "",
      cell: ({ row, isHovered }: any) => {
        return (
          <div className="flex justify-end">
            <div className={`flex gap-2 transition-opacity duration-150 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
              <button
                onClick={() => onEdit(row.original.id)}
                className="bg-blue-500 hover:bg-blue-600 text-white p-1.5 rounded-lg shadow transition"
                title="Editar publicación"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => onDelete(row.original.id)}
                className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-lg shadow transition"
                title="Eliminar publicación"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        );
      },
    },
  ];