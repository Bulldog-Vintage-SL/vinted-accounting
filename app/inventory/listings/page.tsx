/*
  Pagina que muestra los productos simplemente, tiene el boton de añadir uno nuevo, el modal correspondiente
  y la componente de la tabla de los productos.
*/

'use client'

import { useState } from 'react'
import { ListingsTable } from '@/app/inventory/listings/components/ListingsTable'
import { AddListingModal } from '@/app/inventory/listings/components/AddListingModal'
import { InventoryPageShell } from '@/app/inventory/components/inventory-page-shell'

export default function ListingsPage() {
  const [openModal, setOpenModal] = useState(false)

  return (
    <InventoryPageShell
      title="Mis Productos"
      description="Gestiona y visualiza tus productos. Marca como vendido para registrar la venta sin borrar el anuncio en las tiendas."
      action={
        <button
          onClick={() => setOpenModal(true)}
          className="w-full cursor-pointer rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white shadow-md transition-all duration-200 hover:bg-blue-700 hover:shadow-lg sm:w-auto"
        >
          Añadir producto
        </button>
      }
    >
      <ListingsTable />
      <AddListingModal open={openModal} onClose={() => setOpenModal(false)} />
    </InventoryPageShell>
  )
}
