"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BadgeCheck, Loader2, AlertTriangle, RefreshCw, CheckCircle2, Trash2 } from "lucide-react";
import type { Listing } from "@/app/inventory/listings/types";
import type { Publication } from "@/app/inventory/publications/types";
import { formatPlatformName } from "@/libs/inventory/display";
import {
  syncDepopAccount,
  syncVestiaireAccount,
  syncVintedAccount,
  syncWallapopAccount,
} from "@/lib/external-integrations/";
import { useQueue } from "@/hooks/useQueue";
import { useToast } from "@/components/toast";

export interface MarkSoldPublication {
  id: string;
  platform: string;
  status: string;
  price: number | null;
  account_id: string;
  external_id: string;
  publication_url: string | null;
}

export interface MarkSoldPayload {
  publicationId: string | null;
  platform: string;
  salePrice: number;
  saleDate: string;
  purchasePrice: number;
}

interface AccountRow {
  id: string;
  account_name?: string;
  external_id?: string;
  vestiaire_id?: string | null;
  sync_status?: string;
}

interface AccountGroup {
  key: string;
  accountId: string;
  platform: string;
  account_name?: string;
  external_id?: string;
  vestiaire_id?: string | null;
  publicationCount: number;
  isSynced: boolean;
  isSyncing: boolean;
}

interface Props {
  open: boolean;
  listing: Listing | null;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (payload: MarkSoldPayload) => boolean | void | Promise<boolean | void>;
}

const FALLBACK_PLATFORMS = [
  "vinted",
  "wallapop",
  "vestiaire",
  "depop",
  "ebay",
  "shopify",
  "manual",
];

const SYNC_REQUIRED_PLATFORMS = new Set(["vinted", "wallapop", "vestiaire", "depop"]);

export function toQueuePublication(pub: MarkSoldPublication, listing: Listing): Publication {
  return {
    id: pub.id,
    platform: pub.platform,
    status: pub.status,
    price: pub.price,
    sync_status: null,
    external_id: pub.external_id,
    last_sync: null,
    listing: {
      title: listing.title,
      photo_url: listing.photo_url,
    },
    listing_id: listing.id,
    publication_url: pub.publication_url,
    account_id: pub.account_id,
  };
}

function todayInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function runAccountSync(group: AccountGroup) {
  if (group.platform === "vinted") return syncVintedAccount(group.external_id ?? group.accountId);
  if (group.platform === "wallapop") return syncWallapopAccount(group.external_id ?? group.accountId);
  if (group.platform === "vestiaire") {
    return syncVestiaireAccount(group.external_id ?? group.accountId, group.vestiaire_id ?? null);
  }
  if (group.platform === "depop") return syncDepopAccount(group.external_id ?? group.accountId);
  return Promise.resolve({ ok: false, message: "Plataforma no soportada" });
}

export function MarkSoldModal({
  open,
  listing,
  isLoading = false,
  onClose,
  onConfirm,
}: Props) {
  const { pushToast } = useToast();
  const { enqueue } = useQueue<Publication>();

  const [loadingContext, setLoadingContext] = useState(false);
  const [publications, setPublications] = useState<MarkSoldPublication[]>([]);
  const [alreadySold, setAlreadySold] = useState(false);
  const [selectedPublicationId, setSelectedPublicationId] = useState("");
  const [platform, setPlatform] = useState("manual");
  const [salePrice, setSalePrice] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [saleDate, setSaleDate] = useState(todayInputValue());
  const [error, setError] = useState<string | null>(null);
  const [deleteOthers, setDeleteOthers] = useState(true);
  const [selectedDeleteIds, setSelectedDeleteIds] = useState<Set<string>>(new Set());
  const [accountGroups, setAccountGroups] = useState<AccountGroup[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

  const otherPublications = useMemo(
    () =>
      publications.filter(
        (pub) => pub.id !== selectedPublicationId && Boolean(pub.external_id)
      ),
    [publications, selectedPublicationId]
  );

  const selectedToDelete = useMemo(
    () => otherPublications.filter((pub) => selectedDeleteIds.has(pub.id)),
    [otherPublications, selectedDeleteIds]
  );

  const allOthersSelected =
    otherPublications.length > 0 &&
    otherPublications.every((pub) => selectedDeleteIds.has(pub.id));

  useEffect(() => {
    if (!open || !listing) return;

    let cancelled = false;
    setError(null);
    setAlreadySold(listing.status === "sold");
    setSalePrice(listing.price ? String(listing.price) : "");
    setPurchasePrice("");
    setSaleDate(todayInputValue());
    setSelectedPublicationId("");
    setPlatform("manual");
    setPublications([]);
    setDeleteOthers(true);
    setSelectedDeleteIds(new Set());
    setAccountGroups([]);
    setLoadingContext(true);

    fetch(`/api/listings/${listing.id}/mark-sold`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || "No se pudieron cargar las publicaciones");
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        const pubs: MarkSoldPublication[] = data.publications ?? [];
        setPublications(pubs);
        setAlreadySold(Boolean(data.alreadySold));
        if (pubs.length === 1) {
          setSelectedPublicationId(pubs[0].id);
          setPlatform(pubs[0].platform);
          if (pubs[0].price) setSalePrice(String(pubs[0].price));
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Error cargando el producto");
      })
      .finally(() => {
        if (!cancelled) setLoadingContext(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, listing]);

  useEffect(() => {
    setSelectedDeleteIds(new Set(otherPublications.map((pub) => pub.id)));
  }, [otherPublications]);

  const requiredAccountKeys = useMemo(() => {
    const map = new Map<string, { accountId: string; platform: string; count: number }>();
    if (!deleteOthers) return map;
    for (const pub of selectedToDelete) {
      if (!SYNC_REQUIRED_PLATFORMS.has(pub.platform) || !pub.account_id) continue;
      const key = `${pub.platform}:${pub.account_id}`;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { accountId: pub.account_id, platform: pub.platform, count: 1 });
      }
    }
    return map;
  }, [deleteOthers, selectedToDelete]);

  useEffect(() => {
    if (!open) return;

    if (requiredAccountKeys.size === 0) {
      setAccountGroups([]);
      setLoadingAccounts(false);
      return;
    }

    let cancelled = false;
    setLoadingAccounts(true);

    const platforms = Array.from(
      new Set(Array.from(requiredAccountKeys.values()).map((value) => value.platform))
    );

    const load = async () => {
      const fetched: Record<string, AccountRow[]> = {};
      await Promise.all(
        platforms.map(async (accountPlatform) => {
          try {
            const res = await fetch(`/api/accounts?platform=${accountPlatform}`);
            fetched[accountPlatform] = await res.json();
          } catch (err) {
            console.error(`Error cargando cuentas de ${accountPlatform}:`, err);
            fetched[accountPlatform] = [];
          }
        })
      );

      if (cancelled) return;

      const nextGroups: AccountGroup[] = Array.from(requiredAccountKeys.entries()).map(
        ([key, info]) => {
          const accData = (fetched[info.platform] || []).find((account) => account.id === info.accountId);
          return {
            key,
            accountId: info.accountId,
            platform: info.platform,
            account_name: accData?.account_name,
            external_id: accData?.external_id,
            vestiaire_id: accData?.vestiaire_id ?? null,
            publicationCount: info.count,
            isSynced: false,
            isSyncing: false,
          };
        }
      );

      setAccountGroups((prev) => {
        const prevByKey = new Map(prev.map((group) => [group.key, group]));
        return nextGroups.map((group) => {
          const existing = prevByKey.get(group.key);
          if (!existing) return group;
          return {
            ...group,
            isSynced: existing.isSynced,
            isSyncing: existing.isSyncing,
            account_name: group.account_name ?? existing.account_name,
            external_id: group.external_id ?? existing.external_id,
            vestiaire_id: group.vestiaire_id ?? existing.vestiaire_id,
          };
        });
      });
      setLoadingAccounts(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [open, requiredAccountKeys]);

  const handlePublicationChange = (value: string) => {
    setSelectedPublicationId(value);
    if (!value) {
      setPlatform("manual");
      return;
    }
    const pub = publications.find((item) => item.id === value);
    if (pub) {
      setPlatform(pub.platform);
      if (pub.price) setSalePrice(String(pub.price));
    }
  };

  const toggleDeleteId = (id: string) => {
    setSelectedDeleteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllDeleteIds = () => {
    if (allOthersSelected) {
      setSelectedDeleteIds(new Set());
      return;
    }
    setSelectedDeleteIds(new Set(otherPublications.map((pub) => pub.id)));
  };

  const syncOne = useCallback(
    async (group: AccountGroup) => {
      setAccountGroups((prev) =>
        prev.map((item) => (item.key === group.key ? { ...item, isSyncing: true } : item))
      );

      const resSync = await runAccountSync(group);

      if (resSync?.ok) {
        pushToast({ type: "info", message: resSync.message });
      } else {
        pushToast({
          type: "error",
          message: resSync?.message ?? "Error desconocido",
          description: `Intenta recargar la pestaña de ${formatPlatformName(group.platform)} y ten iniciada la sesión.`,
        });
      }

      let isOK = false;
      try {
        const res = await fetch(`/api/accounts?platform=${group.platform}`);
        const data: AccountRow[] = await res.json();
        const updated = data.find((account) => account.id === group.accountId);
        isOK = updated?.sync_status === "OK";
        setAccountGroups((prev) =>
          prev.map((item) =>
            item.key === group.key
              ? {
                  ...item,
                  isSyncing: false,
                  isSynced: isOK,
                  account_name: updated?.account_name ?? item.account_name,
                }
              : item
          )
        );
      } catch (err) {
        console.error(`Error recargando cuenta de ${group.platform}:`, err);
        setAccountGroups((prev) =>
          prev.map((item) =>
            item.key === group.key ? { ...item, isSyncing: false, isSynced: false } : item
          )
        );
      }

      return isOK;
    },
    [pushToast]
  );

  const syncAllPending = useCallback(async () => {
    const pending = accountGroups.filter((group) => !group.isSynced && !group.isSyncing);
    if (pending.length === 0) return true;
    setSyncingAll(true);
    let allOk = true;
    for (const group of pending) {
      const ok = await syncOne(group);
      if (!ok) allOk = false;
    }
    setSyncingAll(false);
    return allOk;
  }, [accountGroups, syncOne]);

  const handleSubmit = async () => {
    const price = Number(salePrice);
    if (Number.isNaN(price) || price < 0) {
      setError("Introduce un precio de venta válido");
      return;
    }
    const cost = purchasePrice === "" ? 0 : Number(purchasePrice);
    if (Number.isNaN(cost) || cost < 0) {
      setError("El coste no puede ser negativo");
      return;
    }
    if (!saleDate) {
      setError("La fecha de venta es obligatoria");
      return;
    }

    const pubsToDelete = deleteOthers ? selectedToDelete : [];
    const listingForDelete = listing;

    if (pubsToDelete.length > 0) {
      const pending = accountGroups.filter((group) => !group.isSynced && !group.isSyncing);
      if (pending.length > 0) {
        const synced = await syncAllPending();
        if (!synced) {
          setError("Sincroniza las cuentas marcadas (o todas) para obtener el token antes de borrar.");
          return;
        }
      }
    }

    const result = await onConfirm({
      publicationId: selectedPublicationId || null,
      platform,
      salePrice: price,
      saleDate,
      purchasePrice: cost,
    });

    if (result === false || !listingForDelete || pubsToDelete.length === 0) return;

    enqueue(
      "deletePublication",
      pubsToDelete.map((pub) => toQueuePublication(pub, listingForDelete)),
      {},
      (pub) => `${listingForDelete.title} · ${formatPlatformName(pub.platform)}`
    );
  };

  const disableActions = isLoading || loadingContext || alreadySold || syncingAll;
  const pendingCount = accountGroups.filter((group) => !group.isSynced).length;
  const anySyncing = accountGroups.some((group) => group.isSyncing);
  const willDelete = deleteOthers && selectedToDelete.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isLoading && !syncingAll) onClose();
      }}
    >
      <DialogContent className="!max-w-[520px] w-full p-0 rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 text-emerald-700 p-2.5 rounded-xl">
                <BadgeCheck size={22} />
              </div>
              <DialogTitle className="text-xl font-bold text-gray-800">
                Marcar como vendido
              </DialogTitle>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {listing && (
            <p className="text-sm font-medium text-gray-500">
              Producto:{" "}
              <span className="text-gray-800 font-semibold">&ldquo;{listing.title}&rdquo;</span>
            </p>
          )}

          {alreadySold && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700">
              Este producto ya está marcado como vendido.
            </div>
          )}

          {loadingContext ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
              <Loader2 size={16} className="animate-spin" />
              Cargando publicaciones...
            </div>
          ) : (
            <>
              {publications.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600">Vendido en</label>
                  <select
                    value={selectedPublicationId}
                    onChange={(e) => handlePublicationChange(e.target.value)}
                    disabled={disableActions}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Otra / manual</option>
                    {publications.map((pub) => (
                      <option key={pub.id} value={pub.id}>
                        {formatPlatformName(pub.platform)}
                        {pub.price != null ? ` · €${Number(pub.price).toFixed(2)}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600">Plataforma</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    disabled={disableActions}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {FALLBACK_PLATFORMS.map((item) => (
                      <option key={item} value={item}>
                        {formatPlatformName(item)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {publications.length > 0 && !selectedPublicationId && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600">Plataforma (si no hay publicación)</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    disabled={disableActions}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {FALLBACK_PLATFORMS.map((item) => (
                      <option key={item} value={item}>
                        {formatPlatformName(item)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600">Precio de venta (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    disabled={disableActions}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600">Coste (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    disabled={disableActions}
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">Fecha de venta</label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  disabled={disableActions}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {otherPublications.length > 0 && (
                <div className="border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deleteOthers}
                      onChange={(e) => setDeleteOthers(e.target.checked)}
                      disabled={disableActions}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-gray-800">
                      <span className="font-semibold">Borrar publicaciones vendidas en otra plataforma</span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        Retira los anuncios que siguen activos donde no se ha vendido.
                      </span>
                    </span>
                  </label>

                  {deleteOthers && (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-gray-600">
                          {selectedToDelete.length} de {otherPublications.length} seleccionada(s)
                        </p>
                        <button
                          type="button"
                          onClick={toggleAllDeleteIds}
                          disabled={disableActions}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
                        >
                          {allOthersSelected ? "Desmarcar todas" : "Marcar todas"}
                        </button>
                      </div>

                      <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
                        {otherPublications.map((pub) => (
                          <label
                            key={pub.id}
                            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50"
                          >
                            <input
                              type="checkbox"
                              checked={selectedDeleteIds.has(pub.id)}
                              onChange={() => toggleDeleteId(pub.id)}
                              disabled={disableActions}
                              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-sm text-gray-800">
                              {formatPlatformName(pub.platform)}
                              {pub.price != null ? ` · €${Number(pub.price).toFixed(2)}` : ""}
                            </span>
                          </label>
                        ))}
                      </div>

                      {loadingAccounts && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Loader2 size={14} className="animate-spin" />
                          Comprobando cuentas para obtener el token…
                        </div>
                      )}

                      {!loadingAccounts && accountGroups.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-gray-600">
                              {pendingCount > 0
                                ? `${pendingCount} de ${accountGroups.length} cuenta(s) por sincronizar`
                                : `${accountGroups.length} cuenta(s) sincronizada(s)`}
                            </p>
                            {pendingCount > 0 && (
                              <button
                                type="button"
                                onClick={syncAllPending}
                                disabled={anySyncing || syncingAll || disableActions}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
                              >
                                Sincronizar todas
                              </button>
                            )}
                          </div>

                          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
                            {accountGroups.map((group) => (
                              <div
                                key={group.key}
                                className={`flex items-center justify-between px-3 py-2.5 ${
                                  group.isSynced ? "bg-green-50/50" : "bg-yellow-50/50"
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div
                                    className={`shrink-0 ${
                                      group.isSyncing
                                        ? "text-blue-500"
                                        : group.isSynced
                                          ? "text-green-500"
                                          : "text-yellow-500"
                                    }`}
                                  >
                                    {group.isSyncing ? (
                                      <Loader2 size={16} className="animate-spin" />
                                    ) : group.isSynced ? (
                                      <CheckCircle2 size={16} />
                                    ) : (
                                      <AlertTriangle size={16} />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">
                                      {group.account_name || "Cuenta sin nombre"}
                                      <span className="text-gray-400 font-normal">
                                        {" "}
                                        · {formatPlatformName(group.platform)}
                                      </span>
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      Hay que obtener el token de nuevo
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => syncOne(group)}
                                  disabled={group.isSyncing || syncingAll || disableActions}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition disabled:opacity-50 ${
                                    group.isSynced
                                      ? "bg-white text-green-700 border border-green-300 hover:bg-green-100"
                                      : "bg-yellow-500 text-white hover:bg-yellow-600"
                                  }`}
                                >
                                  {group.isSyncing ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <RefreshCw size={14} />
                                  )}
                                  {group.isSynced ? "Resincronizar" : "Sincronizar"}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          <div className={`${willDelete ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"} border rounded-xl p-4 flex gap-3`}>
            {willDelete ? (
              <Trash2 size={18} className="text-red-500 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
            )}
            <p className={`text-sm leading-relaxed ${willDelete ? "text-red-800" : "text-amber-800"}`}>
              {willDelete ? (
                <>
                  Se crea la venta y se eliminarán{" "}
                  <span className="font-semibold">{selectedToDelete.length} anuncio(s)</span> en
                  las otras plataformas. La publicación donde se vendió se marca como cerrada en Relist.
                </>
              ) : (
                <>
                  Se crea la venta y el producto pasa a <span className="font-semibold">vendido</span>.
                  Las publicaciones en Relist se marcan como cerradas, pero{" "}
                  <span className="font-semibold">los anuncios en las tiendas siguen activos</span> hasta
                  que los retires en Publicaciones.
                </>
              )}
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-6 pb-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading || syncingAll}
            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition text-sm disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={disableActions || loadingAccounts || anySyncing}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg shadow-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading || syncingAll ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <BadgeCheck size={15} />
            )}
            {isLoading
              ? "Guardando..."
              : syncingAll
                ? "Sincronizando..."
                : willDelete
                  ? "Marcar vendido y borrar"
                  : "Marcar vendido"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
