/*
  Pagina que muestra las publicaciones programadas: fecha/hora,
  cuentas destino, estado, y permite editar la hora o eliminarlas.
*/

'use client'

import { InventoryPageShell } from '@/app/inventory/components/inventory-page-shell'
import { ScheduledUploadsTable } from './components/ScheduledUploadsTable'

export default function ScheduledUploadsPage() {
  return (
    <InventoryPageShell
      title="Subidas Programadas"
      description="Gestiona tus publicaciones programadas: revisa la fecha de subida, cambia la hora o cancélalas."
    >
      <ScheduledUploadsTable />
    </InventoryPageShell>
  )
}