'use client'

import {
  ColumnDef, flexRender, getCoreRowModel, useReactTable,
} from '@tanstack/react-table'
import { useEffect, useState, useImperativeHandle, forwardRef, type Ref, type ReactElement } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// Exporta el tipo para usarlo en ListingsTable
export interface DataTableHandle {
  resetSelection: () => void
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  onSelectionChange?: (ids: string[]) => void
}

export const DataTable = forwardRef(function DataTable<TData, TValue>(
  { columns, data, onSelectionChange }: DataTableProps<TData, TValue>,
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
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
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
                className="relative"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
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