/*
  Pagina que muestra los productos simplemente, tiene el boton de añadir uno nuevo, el modal correspondiente
  y la componente de la tabla de los productos.
*/

'use client'


import { useState } from 'react'
import { ListingsTable } from '@/app/inventory/listings/components/ListingsTable'
import { AddListingModal } from '@/app/inventory/listings/components/AddListingModal'

export default function ListingsPage() {

  const [openModal, setOpenModal] = useState(false)

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-3 sm:p-6">

      <div className="
        bg-white shadow-xl rounded-2xl p-4 sm:p-6 w-full max-w-6xl border border-gray-200
        flex flex-col
        transition-all duration-300
        hover:-translate-y-1 hover:shadow-2xl
      ">

        {/* Titulo y boton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            Mis Productos
          </h1>

          <button
            onClick={() => setOpenModal(true)}
            className="
            bg-blue-600 hover:bg-blue-700 
            text-white font-semibold 
            px-4 py-2.5 rounded-lg 
            shadow-md hover:shadow-lg 
            transition-all duration-200
            cursor-pointer
            w-full sm:w-auto
            "
          >
            Añadir producto
          </button>
        </div>
        

        <p className="text-gray-600 mb-6 sm:mb-8 text-sm sm:text-base">
          Gestiona y visualiza tus productos.
        </p>

        <ListingsTable />
        <AddListingModal open={openModal} onClose={() => setOpenModal(false)} />
      </div>


    </main>
  )
}