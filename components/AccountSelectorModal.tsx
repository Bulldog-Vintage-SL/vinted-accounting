/*
  Modal para elegir la cuenta sobre la que recaiga una accion.
*/

"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useAccountSelector } from "@/hooks/useAccountSelector";
import { useEffect, useState } from "react";
import type { SyncStatus } from "@/app/settings/accounts/types";
import { syncVintedAccount, syncWallapopAccount, syncVestiaireAccount } from '@/lib/external-integrations'
import { useToast } from "@/components/toast"

const PLATFORM_LOGOS: Record<string, string> = {
  vinted: "/icons/vinted.svg",
  wallapop: "/icons/wallapop.svg",
  vestiaire: "/icons/vestiaire.jpeg",
  shopify: "/icons/shopify.svg",
  ebay: "/icons/ebay.svg",
  unknown: "/icons/default.svg",
};

const PLATFORM_NAMES: Record<string, string> = {
  vinted: "Vinted",
  wallapop: "Wallapop",
  vestiaire: "Vestiaire Collective",
  shopify: "Shopify",
  ebay: "eBay",
};

const PLATFORM_ORDER = ["vinted", "wallapop", "vestiaire", "shopify"];

// Plataformas cuyas cuentas no requieren sincronización manual (auth server-side vía OAuth/API)
const NO_SYNC_REQUIRED = new Set(["shopify"]);

export default function AccountSelectorModal() {
  const { pushToast } = useToast();
  const { open, closeSelector, action } = useAccountSelector();

  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [collapsedPlatforms, setCollapsedPlatforms] = useState<Set<string>>(new Set(PLATFORM_ORDER));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Sesiones sincronizadas en esta sesion
  const [syncedInSession, setSyncedInSession] = useState<Set<string>>(new Set());

  // Mapa de funciones de sync
  const syncMap: Record<string, (acc: any) => Promise<any>> = {
    vinted: (acc) => syncVintedAccount(acc.external_id),
    wallapop: (acc) => syncWallapopAccount(acc.external_id),
    vestiaire: (acc) => syncVestiaireAccount(acc.external_id, acc.vestiaire_id ?? null),
  };
  // Nombre legible para errores
  const platformName = (platform: string) => PLATFORM_NAMES[platform] || platform;

  useEffect(() => {
    if (!open) return;
    setAccounts([]);
    setLoading(true);
    setIsConfirming(false);
    setSyncingId(null);
    setCollapsedPlatforms(new Set(PLATFORM_ORDER));
    setSelectedIds(new Set());
    setSyncedInSession(new Set());

    const loadAll = async () => {
      const allAccounts: any[] = [];
      for (const platform of PLATFORM_ORDER) {
        try {
          const res = await fetch(`/api/accounts?platform=${platform}`);
          const data = await res.json();
          allAccounts.push(...data.map((a: any) => ({ ...a, platform: a.platform || platform })));
        } catch (e) {
          console.error(`Error cargando cuentas de ${platform}:`, e);
        }
      }
      setAccounts(allAccounts);

      // Las cuentas de plataformas sin sync manual (ej. Shopify) se marcan
      // como sincronizadas automáticamente, ya que su auth vive server-side.
      const autoSynced = allAccounts
        .filter((a) => NO_SYNC_REQUIRED.has(a.platform))
        .map((a) => a.id);
      if (autoSynced.length > 0) {
        setSyncedInSession(new Set(autoSynced));
      }

      setLoading(false);
    };
    loadAll();
  }, [open]);

  const syncAccount = async (accountId: string): Promise<boolean> => {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return false;

    // Plataformas sin sync manual: no hay nada que sincronizar, se consideran listas
    if (NO_SYNC_REQUIRED.has(account.platform)) {
      setSyncedInSession(prev => {
        const next = new Set(prev);
        next.add(accountId);
        return next;
      });
      return true;
    }

    setSyncingId(accountId);

    const syncFn = syncMap[account.platform];
    if (!syncFn) {
      pushToast({
        type: "error",
        message: `Plataforma "${account.platform}" no soportada para sincronización`,
      });
      setSyncingId(null);
      return false;
    }

    const resSync = await syncFn(account);

    if (resSync?.ok) {
      pushToast({ type: "info", message: resSync.message });
    } else {
      const platform = platformName(account.platform);
      pushToast({
        type: "error",
        message: resSync?.message ?? "Error desconocido",
        description: `Intenta recargar la pestaña de ${platform} y ten iniciada la sesión.`
      });
    }

    // Recargar cuentas
    const allAccounts: any[] = [];
    for (const platform of PLATFORM_ORDER) {
      try {
        const res = await fetch(`/api/accounts?platform=${platform}`);
        const data = await res.json();
        allAccounts.push(...data.map((a: any) => ({ ...a, platform: a.platform || platform })));
      } catch (e) {
        console.error(`Error cargando cuentas de ${platform}:`, e);
      }
    }
    setAccounts(allAccounts);
    setSyncingId(null);

    const updated = allAccounts.find((a: any) => a.id === accountId);
    const isOK = updated?.sync_status === "OK";

    if (isOK) {
      // Marcar como sincronizada en esta sesión
      setSyncedInSession(prev => {
        const next = new Set(prev);
        next.add(accountId);
        return next;
      });

      // Auto-seleccionar tras sincronizar correctamente
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.add(accountId);
        return next;
      });
    } else {
      // Si falla quitar de sincronizadas y deseleccionar
      setSyncedInSession(prev => {
        const next = new Set(prev);
        next.delete(accountId);
        return next;
      });
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(accountId);
        return next;
      });
    }

    return isOK;
  };

  const handleAccountClick = (acc: any) => {
    const needsSync = !syncedInSession.has(acc.id);

    if (needsSync) {
      // Obligar a sincronizar primero
      syncAccount(acc.id);
      return;
    }

    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(acc.id)) {
        next.delete(acc.id);
      } else {
        next.add(acc.id);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedAccounts = accounts.filter(a => selectedIds.has(a.id));

    if (selectedAccounts.length === 0) {
      pushToast({
        type: "error",
        message: "Selecciona al menos una cuenta"
      });
      return;
    }

    setIsConfirming(true);

    const accountsPayload = selectedAccounts.map(a => ({
      accountId: a.id,
      platform: a.platform
    }));

    action?.(accountsPayload);
    closeSelector();
    setIsConfirming(false);
  };

  const togglePlatform = (platform: string) => {
    setCollapsedPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(platform)) {
        next.delete(platform);
      } else {
        next.add(platform);
      }
      return next;
    });
  };

  const groupedAccounts = PLATFORM_ORDER
    .map(platform => ({
      platform,
      accounts: accounts.filter(a => a.platform === platform)
    }))
    .filter(group => group.accounts.length > 0);

  const selectedCount = selectedIds.size;
  const unsyncedCount = accounts.filter(a => !syncedInSession.has(a.id)).length;

  return (
    <Dialog open={open} onOpenChange={closeSelector}>
      <DialogContent className="!max-w-[600px] w-full rounded-xl p-0 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-800">
              Selecciona cuentas
            </DialogTitle>
            <p className="text-sm text-gray-500 mt-1">
              {selectedCount > 0
                ? `${selectedCount} cuenta(s) seleccionada(s)`
                : unsyncedCount > 0
                  ? `Sincroniza las cuentas para poder seleccionarlas (${unsyncedCount} pendientes)`
                  : "Todas las cuentas están listas"}
            </p>
          </DialogHeader>
        </div>

        <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-3 text-gray-500">Cargando cuentas…</span>
            </div>
          )}

          {!loading && groupedAccounts.length === 0 && (
            <p className="text-center text-gray-500 py-8">No tienes cuentas registradas.</p>
          )}

          {!loading && groupedAccounts.map(({ platform, accounts: platformAccounts }) => (
            <div key={platform} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => togglePlatform(platform)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition"
              >
                <img
                  src={PLATFORM_LOGOS[platform] || PLATFORM_LOGOS.unknown}
                  alt={platform}
                  className="w-7 h-7 rounded-md"
                />
                <span className="font-semibold text-gray-800">
                  {PLATFORM_NAMES[platform] || platform}
                </span>
                <span className="text-sm text-gray-500 ml-1">
                  ({platformAccounts.length})
                </span>
                <div className="flex-1" />
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${collapsedPlatforms.has(platform) ? '' : 'rotate-180'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {!collapsedPlatforms.has(platform) && (
                <div className="divide-y divide-gray-100">
                  {platformAccounts.map((acc) => {
                    const isSelected = selectedIds.has(acc.id);
                    const isSynced = syncedInSession.has(acc.id);
                    const isSyncing = syncingId === acc.id;
                    const noSyncNeeded = NO_SYNC_REQUIRED.has(acc.platform);

                    return (
                      <div
                        key={acc.id}
                        onClick={() => handleAccountClick(acc)}
                        className={`flex items-center justify-between px-4 py-3 transition cursor-pointer ${isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
                          } ${isSyncing ? 'opacity-70' : ''}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Icono de estado */}
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${isSyncing
                            ? 'border-blue-400 bg-blue-50'
                            : !isSynced
                              ? 'border-yellow-400 bg-yellow-50'
                              : isSelected
                                ? 'bg-blue-600 border-blue-600'
                                : 'border-green-400 bg-green-50'
                            }`}>
                            {isSyncing ? (
                              <svg className="animate-spin h-3 w-3 text-blue-500" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : !isSynced ? (
                              <svg className="w-3 h-3 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            ) : isSelected ? (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>

                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`font-medium truncate ${!isSynced ? 'text-yellow-700' : 'text-gray-900'
                                }`}>
                                {acc.account_name || "Cuenta sin nombre"}
                              </span>
                              {!isSynced && (
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium shrink-0">
                                  Sincronizar para usar
                                </span>
                              )}
                              {isSynced && !isSelected && (
                                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium shrink-0">
                                  Lista
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-sm font-medium ${statusColor(acc.sync_status)}`}>
                                {statusLabel(acc.sync_status)}
                              </span>
                              <span className="text-xs text-gray-400">
                                · Última sync:{" "}
                                {acc.last_sync
                                  ? new Date(acc.last_sync).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })
                                  : "Nunca"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {!noSyncNeeded && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              syncAccount(acc.id);
                            }}
                            disabled={isSyncing}
                            className={`p-1.5 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ml-3 ${!isSynced
                              ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                              }`}
                            title={!isSynced ? "Sincronizar para poder usar esta cuenta" : "Sincronizar de nuevo"}
                          >
                            {isSyncing ? (
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={closeSelector}
            disabled={isConfirming}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition cursor-pointer font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedCount === 0 || isConfirming}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition cursor-pointer font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {isConfirming && <Loader2 className="h-4 w-4 animate-spin" />}
            {isConfirming ? "Aplicando..." : `Aplicar en ${selectedCount > 0 ? `${selectedCount} cuenta(s)` : 'cuentas'}`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function statusLabel(status: SyncStatus) {
  const labels: Record<SyncStatus, string> = {
    OK: "Activa",
    NEEDS_SYNC: "Requiere sincronización",
    ACCOUNT_NOT_FOUND: "Sesión expirada",
  };
  return labels[status] || status;
}

function statusColor(status: SyncStatus) {
  const colors: Record<SyncStatus, string> = {
    OK: "text-green-600",
    NEEDS_SYNC: "text-yellow-600",
    ACCOUNT_NOT_FOUND: "text-red-600",
  };
  return colors[status] || "text-gray-500";
}