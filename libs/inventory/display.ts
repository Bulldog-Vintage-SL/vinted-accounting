const PUBLICATION_STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  draft: "Borrador",
  closed: "Cerrada",
  reserved: "Reservada",
  hidden: "Oculta",
  inactive: "Inactiva",
  archived: "Archivada",
  sold: "Vendida",
};

export const PLATFORM_NAMES: Record<string, string> = {
  vinted: "Vinted",
  wallapop: "Wallapop",
  vestiaire: "Vestiaire Collective",
  ebay: "eBay",
  shopify: "Shopify",
  depop: "Depop",
  manual: "Manual",
};

export const PLATFORM_ICONS: Record<string, string> = {
  vinted: "/icons/vinted.svg",
  wallapop: "/icons/wallapop.svg",
  vestiaire: "/icons/vestiaire.jpeg",
  ebay: "/icons/ebay.svg",
  shopify: "/icons/shopify.svg",
  depop: "/icons/depop.jpeg",
};

export const PLATFORM_ORDER = [
  "vinted",
  "wallapop",
  "vestiaire",
  "depop",
  "ebay",
  "shopify",
] as const;

export function sortPlatforms(platforms: string[]): string[] {
  return [...new Set(platforms)].sort((a, b) => {
    const indexA = PLATFORM_ORDER.indexOf(a as (typeof PLATFORM_ORDER)[number]);
    const indexB = PLATFORM_ORDER.indexOf(b as (typeof PLATFORM_ORDER)[number]);
    const orderA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
    const orderB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;
    return orderA - orderB || a.localeCompare(b);
  });
}

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

export function formatPlatformName(platform: string | null | undefined): string {
  if (!platform) return "—";
  return PLATFORM_NAMES[platform] ?? platform;
}

const LISTING_STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  inactive: "Inactivo",
  closed: "Cerrado",
  sold: "Vendido",
  banned: "Bloqueado",
};

export function formatListingStatus(status: string | null | undefined): string {
  const key = (status?.trim() || "active").toLowerCase();
  return LISTING_STATUS_LABELS[key] ?? status ?? "Activo";
}

export function listingStatusClass(status: string | null | undefined): string {
  const key = (status?.trim() || "active").toLowerCase();
  if (key === "active") return "bg-green-100 text-green-700";
  if (key === "banned") return "bg-red-100 text-red-700";
  if (key === "sold" || key === "closed" || key === "inactive") {
    return "bg-gray-200 text-gray-700";
  }
  return "bg-blue-100 text-blue-700";
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
  if (key === "closed" || key === "inactive" || key === "archived" || key === "hidden" || key === "sold") {
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
