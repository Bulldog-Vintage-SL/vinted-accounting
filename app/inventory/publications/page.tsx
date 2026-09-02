/*
  Pagina con la tabla de publiaciones.
*/

import { PublicationsTable } from '@/app/inventory/publications/components/PublicationsTable'
import { InventoryPageShell } from '@/app/inventory/components/inventory-page-shell'

export default function PublicationsPage() {
  return (
    <InventoryPageShell
      title="Mis Publicaciones"
      description="Gestiona y visualiza tus publicaciones."
    >
      <PublicationsTable />
    </InventoryPageShell>
  )
}
