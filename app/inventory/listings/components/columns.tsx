'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Listing } from '@/app/inventory/listings/types'
import { Trash2, Send, Loader2, BadgeCheck } from 'lucide-react'
import Link from 'next/link'
import { formatListingStatus, listingStatusClass } from '@/libs/inventory/display'
import { PlatformLogos } from '@/app/inventory/components/platform-logos'

export const createColumns = (
  onDelete: (id: string) => void,
  onPublish: (listing: Listing) => void,
  onMarkSold: (listing: Listing) => void,
  publishingListingId: string | null,
): ColumnDef<Listing>[] => [

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
      accessorKey: 'photo_url',
      header: 'Foto',
      meta: {
        headerClassName: 'w-16',
        cellClassName: 'w-16',
      },
      cell: ({ row }) => {
        const urls = row.getValue('photo_url') as string[]
        const firstUrl = urls?.[0]
        if (!firstUrl) {
          return <div className="h-12 w-12 shrink-0 rounded-md bg-gray-100" />
        }
        return (
          <img
            src={firstUrl}
            alt={row.getValue('title') as string}
            className="h-12 w-12 rounded-md object-cover"
          />
        )
      },
    },

    {
      accessorKey: 'title',
      header: 'Título',
      meta: {
        headerClassName: 'w-[20%] max-w-[180px]',
        cellClassName: 'w-[20%] max-w-[180px]',
      },
      cell: ({ row }) => {
        const title = row.getValue('title') as string
        return (
          <Link
            href={`/inventory/listings/${row.original.id}`}
            className="block truncate font-medium text-blue-600 transition hover:text-blue-800 hover:underline"
            title={title}
          >
            {title}
          </Link>
        )
      },
    },

    {
      id: 'platforms',
      header: 'Plataformas',
      meta: {
        headerClassName: 'w-[14%] whitespace-normal',
        cellClassName: 'w-[14%] whitespace-normal',
      },
      cell: ({ row }) => (
        <PlatformLogos platforms={row.original.platforms ?? []} />
      ),
    },

    {
      accessorKey: 'sku',
      header: 'SKU',
      meta: {
        headerClassName: 'hidden w-[10%] max-w-[90px] lg:table-cell',
        cellClassName: 'hidden w-[10%] max-w-[90px] lg:table-cell',
      },
      cell: ({ row }) => {
        const sku = row.getValue('sku') as string
        return (
          <span className="block truncate text-gray-600" title={sku}>
            {sku || '—'}
          </span>
        )
      },
    },

    {
      accessorKey: 'price',
      header: 'Precio',
      meta: {
        headerClassName: 'w-[8%]',
        cellClassName: 'w-[8%]',
      },
      cell: ({ row }) => {
        const price = parseFloat(row.getValue('price'))
        return <span className="tabular-nums">€{price.toFixed(2)}</span>
      },
    },

    {
      accessorKey: 'status',
      header: 'Estado',
      meta: {
        headerClassName: 'w-[9%]',
        cellClassName: 'w-[9%]',
      },
      cell: ({ row }) => {
        const status = row.getValue('status') as string
        const label = formatListingStatus(status)
        return (
          <span
            className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ${listingStatusClass(status)}`}
            title={label}
          >
            {label}
          </span>
        )
      },
    },

    {
      accessorKey: 'condition',
      header: 'Cond.',
      meta: {
        headerClassName: 'hidden w-[10%] max-w-[90px] xl:table-cell',
        cellClassName: 'hidden w-[10%] max-w-[90px] xl:table-cell',
      },
      cell: ({ row }) => {
        const condition = row.getValue('condition') as string
        return (
          <span className="block truncate" title={condition}>
            {condition || '—'}
          </span>
        )
      },
    },

    {
      accessorKey: 'delivery_method',
      header: 'Envío',
      meta: {
        headerClassName: 'hidden w-[9%] max-w-[80px] xl:table-cell',
        cellClassName: 'hidden w-[9%] max-w-[80px] xl:table-cell',
      },
      cell: ({ row }) => {
        const method = row.getValue('delivery_method') as string
        return (
          <span className="block truncate" title={method}>
            {method || '—'}
          </span>
        )
      },
    },

    {
      accessorKey: 'created_at',
      header: 'Creado',
      meta: {
        headerClassName: 'hidden w-[10%] xl:table-cell',
        cellClassName: 'hidden w-[10%] xl:table-cell',
      },
      cell: ({ row }) => (
        <span className="tabular-nums text-gray-600">
          {new Date(row.getValue('created_at')).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: '2-digit',
          })}
        </span>
      ),
    },

    {
      id: 'actions',
      header: '',
      meta: {
        headerClassName: 'w-32',
        cellClassName: 'w-32',
      },
      cell: ({ row, isHovered }: { row: { original: Listing }; isHovered?: boolean }) => {
        const isPublishing = publishingListingId === row.original.id
        const isSold = row.original.status === 'sold'

        return (
          <div className="flex justify-end">
            <div className={`flex gap-1.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 ${isHovered ? 'md:opacity-100' : ''}`}>
              {!isSold && (
                <button
                  onClick={() => onMarkSold(row.original)}
                  className="rounded-lg bg-emerald-600 p-2 text-white shadow transition hover:bg-emerald-700"
                  title="Marcar como vendido"
                >
                  <BadgeCheck size={16} />
                </button>
              )}

              <button
                onClick={() => onPublish(row.original)}
                disabled={isPublishing || isSold}
                className="rounded-lg bg-blue-600 p-2 text-white shadow transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                title={isSold ? 'Producto vendido' : 'Publicar'}
              >
                {isPublishing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>

              <button
                onClick={() => onDelete(row.original.id)}
                className="rounded-lg bg-red-500 p-2 text-white shadow transition hover:bg-red-600"
                title="Eliminar"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )
      },
    },

  ]
