'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Listing } from '@/app/inventory/listings/types'
import { Trash2, Send, Loader2 } from 'lucide-react'
import Link from 'next/link'

export const createColumns = (
  onDelete: (id: string) => void,
  onPublish: (listing: Listing) => void,
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
        headerClassName: 'w-14',
        cellClassName: 'w-14',
      },
      cell: ({ row }) => {
        const urls = row.getValue('photo_url') as string[]
        const firstUrl = urls?.[0]
        if (!firstUrl) return <span className="text-gray-400 text-xs">—</span>
        return (
          <img
            src={firstUrl}
            alt={row.getValue('title') as string}
            className="w-10 h-10 rounded-md object-cover"
          />
        )
      },
    },

    {
      accessorKey: 'title',
      header: 'Título',
      meta: {
        headerClassName: 'w-[22%] max-w-[180px]',
        cellClassName: 'w-[22%] max-w-[180px]',
      },
      cell: ({ row }) => {
        const title = row.getValue('title') as string
        return (
          <Link
            href={`/inventory/listings/${row.original.id}`}
            className="block truncate text-blue-600 hover:underline hover:text-blue-800 transition font-medium"
            title={title}
          >
            {title}
          </Link>
        )
      },
    },

    {
      accessorKey: 'sku',
      header: 'SKU',
      meta: {
        headerClassName: 'w-[10%] max-w-[90px]',
        cellClassName: 'w-[10%] max-w-[90px]',
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
        const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
          active: 'default',
          inactive: 'secondary',
          banned: 'destructive',
        }
        return <Badge variant={variants[status] ?? 'default'} className="text-[10px] px-1.5 py-0">{status}</Badge>
      },
    },

    {
      accessorKey: 'condition',
      header: 'Cond.',
      meta: {
        headerClassName: 'w-[10%] max-w-[90px]',
        cellClassName: 'w-[10%] max-w-[90px]',
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
        headerClassName: 'w-[9%] max-w-[80px]',
        cellClassName: 'w-[9%] max-w-[80px]',
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
        headerClassName: 'w-[10%]',
        cellClassName: 'w-[10%]',
      },
      cell: ({ row }) => (
        <span className="text-gray-600 tabular-nums">
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
        headerClassName: 'w-24',
        cellClassName: 'w-24',
      },
      cell: ({ row, isHovered }: any) => {
        const isPublishing = publishingListingId === row.original.id

        return (
          <div className="flex justify-end">
            <div className={`flex gap-1.5 transition-opacity opacity-100 md:opacity-0 md:group-hover:opacity-100 ${isHovered ? 'md:opacity-100' : ''}`}>
              <button
                onClick={() => onPublish(row.original)}
                disabled={isPublishing}
                className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg shadow transition disabled:opacity-50 disabled:cursor-not-allowed"
                title="Publicar"
              >
                {isPublishing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>

              <button
                onClick={() => onDelete(row.original.id)}
                className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg shadow transition"
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
