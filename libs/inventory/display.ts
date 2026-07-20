const PUBLICATION_STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  draft: "Borrador",
  closed: "Cerrada",
  reserved: "Reservada",
  hidden: "Oculta",
  inactive: "Inactiva",
  archived: "Archivada",
};

const SYNC_STATUS_LABELS: Record<string, string> = {
  synced: "Sincronizado",
  live: "En vivo",
  ok: "OK",
  pending: "Pendiente",
  success: "OK",
  failed: "Error",
  error: "Error",
};

export function normalizePublicationStatus(status: string | null | undefined): string {
  return (status?.trim() || "active").toLowerCase();
}

export function formatPublicationStatus(status: string | null | undefined): string {
  const key = normalizePublicationStatus(status);
  return PUBLICATION_STATUS_LABELS[key] ?? status ?? "Activa";
}

export function formatSyncStatus(sync: string | null | undefined): string {
  if (!sync) return "—";
  const key = sync.toLowerCase();
  return SYNC_STATUS_LABELS[key] ?? sync;
}

export function publicationStatusClass(status: string | null | undefined): string {
  const key = normalizePublicationStatus(status);
  if (key === "active" || key === "live") {
    return "bg-green-100 text-green-700";
  }
  if (key === "draft" || key === "pending" || key === "reserved") {
    return "bg-yellow-100 text-yellow-700";
  }
  if (key === "closed" || key === "inactive" || key === "archived" || key === "hidden") {
    return "bg-gray-200 text-gray-700";
  }
  return "bg-blue-100 text-blue-700";
}

export function syncStatusClass(sync: string | null | undefined): string {
  if (!sync) return "bg-gray-100 text-gray-600";
  const key = sync.toLowerCase();
  if (key === "pending") return "bg-yellow-100 text-yellow-700";
  if (key === "failed" || key === "error") return "bg-red-100 text-red-700";
  return "bg-green-100 text-green-700";
}
