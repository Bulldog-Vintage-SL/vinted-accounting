'use client'

import {
  ColumnDef, flexRender, getCoreRowModel, useReactTable,
} from '@tanstack/react-table'
import { useEffect, useState, useImperativeHandle, forwardRef, type Ref, type ReactElement } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData, TValue> {
    headerClassName?: string
    cellClassName?: string
  }
}

// Exporta el tipo para usarlo en ListingsTable
export interface DataTableHandle {
  resetSelection: () => void
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  onSelectionChange?: (ids: string[]) => void
  compact?: boolean
}

export const DataTable = forwardRef(function DataTable<TData, TValue>(
  { columns, data, onSelectionChange, compact = false }: DataTableProps<TData, TValue>,
  ref: Ref<DataTableHandle>
) {
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)
  const [rowSelection, setRowSelection] = useState({})

  const table = useReactTable({
    data,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
  })

  // Expone resetSelection al padre
  useImperativeHandle(ref, () => ({
    resetSelection: () => setRowSelection({}),
  }))

  useEffect(() => {
    const ids = table.getSelectedRowModel().rows.map(r => (r.original as any).id)
    onSelectionChange?.(ids)
  }, [rowSelection])

  return (
    <div className="rounded-md border overflow-hidden">
      <Table className={cn(compact && 'table-fixed w-full text-xs sm:text-sm')}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    compact && 'px-1.5 py-2',
                    header.column.columnDef.meta?.headerClassName,
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                onMouseEnter={() => setHoveredRowId(row.id)}
                onMouseLeave={() => setHoveredRowId(null)}
                className="relative group"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      compact && 'px-1.5 py-2',
                      cell.column.columnDef.meta?.cellClassName,
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, {
                      ...cell.getContext(),
                      isHovered: hoveredRowId === row.id,
                    } as typeof cell extends never ? never : ReturnType<typeof cell.getContext> & { isHovered: boolean })}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                Sin resultados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
} ) as <TData, TValue>(
  props: DataTableProps<TData, TValue> & { ref?: Ref<DataTableHandle> }
) => ReactElement