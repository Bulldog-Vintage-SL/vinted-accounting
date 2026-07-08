'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Listing } from '@/app/inventory/listings/types'
import { Trash2, Send } from 'lucide-react'
import Link from 'next/link'
import type { Toast } from "@/components/toast/ToastContext"
import type { SelectedAccount } from '@/hooks/useAccountSelector'

export const createColumns = (
  onDelete: (id: string) => void,
  openSelector: (action: (accounts: SelectedAccount[]) => void) => void,
  pushToast: (toast: Omit<Toast, "id">) => void,
  enqueue: (action: any, entities: any[], payload: any, getLabel: (entity: any) => string) => any
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
      size: 40,
    },

    {
      accessorKey: 'photo_url',
      header: 'Foto',
      cell: ({ row }) => {
        const urls = row.getValue('photo_url') as string[]
        const firstUrl = urls?.[0]
        if (!firstUrl) return <span className="text-gray-400 text-xs">Sin foto</span>
        return (
          <img
            src={firstUrl}
            alt={row.getValue('title')}
            className="w-12 h-12 rounded-lg object-cover"
          />
        )
      },
    },

    {
      accessorKey: 'title',
      header: 'Título',
      cell: ({ row }) => (
        <Link
          href={`/inventory/listings/${row.original.id}`}
          className="text-blue-600 hover:underline hover:text-blue-800 transition font-medium"
        >
          {row.getValue('title')}
        </Link>
      ),
    },

    {
      accessorKey: 'sku',
      header: 'SKU',
    },

    {
      accessorKey: 'price',
      header: 'Precio',
      cell: ({ row }) => {
        const price = parseFloat(row.getValue('price'))
        return <span>€{price.toFixed(2)}</span>
      },
    },

    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => {
        const status = row.getValue('status') as string
        const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
          active: 'default',
          inactive: 'secondary',
          banned: 'destructive',
        }
        return <Badge variant={variants[status] ?? 'default'}>{status}</Badge>
      },
    },

    {
      accessorKey: 'condition',
      header: 'Condición',
    },

    {
      accessorKey: 'delivery_method',
      header: 'Envío',
    },

    {
      accessorKey: 'created_at',
      header: 'Creado',
      cell: ({ row }) => new Date(row.getValue('created_at')).toLocaleDateString('es-ES'),
    },

    {
      id: 'actions',
      header: '',
      cell: ({ row, isHovered }: any) => {

        const handlePublish = () => {
          openSelector((accounts) => {
            if (accounts.length === 0) return
            const jobs = accounts.map(account => ({
              listing: row.original,
              account
            }))

            enqueue('upload', jobs, {}, (item: any) => {
              return `${item.listing.title} en ${item.account.platform}`
            })
          })
        }

        return (
          <div className="flex justify-end">
            <div className={`flex gap-2 transition-opacity duration-150 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
              <button
                onClick={handlePublish}
                className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-lg shadow transition"
                title="Publicar"
              >
                <Send size={14} />
              </button>

              <button
                onClick={() => onDelete(row.original.id)}
                className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-lg shadow transition"
                title="Eliminar"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        )
      },
    },

  ]