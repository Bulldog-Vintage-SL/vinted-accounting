/*
  Pagina con la tabla de publiaciones. 
*/

import { PublicationsTable } from '@/app/inventory/publications/components/PublicationsTable'

export default function PublicationsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-6">

      <div className="
        bg-white shadow-xl rounded-2xl p-10 w-full max-w-6xl border border-gray-200
        flex flex-col
        transition-all duration-300
        hover:-translate-y-1 hover:shadow-2xl
      ">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Mis Publicaciones
        </h1>
        <p className="text-gray-600 mb-8">
          Gestiona y visualiza tus publicaciones.
        </p>

        <PublicationsTable />
      </div>

    </main>
  )
}