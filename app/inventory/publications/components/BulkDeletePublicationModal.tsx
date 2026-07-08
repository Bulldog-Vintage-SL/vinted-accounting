"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Trash2, Loader2, RefreshCw, CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { SyncStatus } from "@/app/settings/accounts/types";
import { syncVintedAccount, syncWallapopAccount, syncVestiaireAccount } from '@/lib/extensionBridge';
import { useToast } from "@/components/toast";
import { Publication } from '../types';

interface Props {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    publications: Publication[];
    isLoading?: boolean;
}

const PLATFORM_NAMES: Record<string, string> = {
    vinted: "Vinted",
    wallapop: "Wallapop",
    vestiaire: "Vestiaire Collective",
    shopify: "Shopify",
};

// Plataformas que requieren la extension
const SYNC_REQUIRED_PLATFORMS = new Set(["vinted", "wallapop", "vestiaire"]);

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

export function BulkDeletePublicationModal({
    open,
    onClose,
    onConfirm,
    publications,
    isLoading = false,
}: Props) {
    const { pushToast } = useToast();

    const [accountGroups, setAccountGroups] = useState<AccountGroup[]>([]);
    const [loadingAccounts, setLoadingAccounts] = useState(false);

    // Publicaciones que no requieren cuenta sincronizada (otras plataformas)
    const freePublicationsCount = useMemo(
        () => publications.filter(p => !SYNC_REQUIRED_PLATFORMS.has(p.platform) || !p.account_id).length,
        [publications]
    );

    // Agrupacion inicial: cuentas unicas a partir de las publicaciones seleccionadas
    const requiredAccountKeys = useMemo(() => {
        const map = new Map<string, { accountId: string; platform: string; count: number }>();
        for (const p of publications) {
            if (!SYNC_REQUIRED_PLATFORMS.has(p.platform) || !p.account_id) continue;
            const key = `${p.platform}:${p.account_id}`;
            const existing = map.get(key);
            if (existing) {
                existing.count += 1;
            } else {
                map.set(key, { accountId: p.account_id, platform: p.platform, count: 1 });
            }
        }
        return map;
    }, [publications]);

    useEffect(() => {
        if (!open) return;

        setAccountGroups([]);

        if (requiredAccountKeys.size === 0) return;

        setLoadingAccounts(true);

        const platforms = Array.from(new Set(Array.from(requiredAccountKeys.values()).map(v => v.platform)));

        const load = async () => {
            const fetched: Record<string, any[]> = {};
            for (const platform of platforms) {
                try {
                    const res = await fetch(`/api/accounts?platform=${platform}`);
                    fetched[platform] = await res.json();
                } catch (e) {
                    console.error(`Error cargando cuentas de ${platform}:`, e);
                    fetched[platform] = [];
                }
            }

            const groups: AccountGroup[] = Array.from(requiredAccountKeys.entries()).map(([key, info]) => {
                const accData = (fetched[info.platform] || []).find((a: any) => a.id === info.accountId);
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
            });

            setAccountGroups(groups);
            setLoadingAccounts(false);
        };

        load();
    }, [open, requiredAccountKeys]);

    const runSync = (group: AccountGroup) => {
        if (group.platform === "vinted") return syncVintedAccount(group.external_id ?? group.accountId);
        if (group.platform === "wallapop") return syncWallapopAccount(group.external_id ?? group.accountId);
        return syncVestiaireAccount(group.external_id ?? group.accountId, group.vestiaire_id ?? null);
    };

    const syncOne = async (group: AccountGroup) => {
        setAccountGroups(prev => prev.map(g => g.key === group.key ? { ...g, isSyncing: true } : g));

        const resSync = await runSync(group);

        if (resSync?.ok) {
            pushToast({ type: "info", message: resSync.message });
        } else {
            pushToast({
                type: "error",
                message: resSync?.message ?? "Error desconocido",
                description: `Intenta recargar la pestaña de ${PLATFORM_NAMES[group.platform] || group.platform} y ten iniciada la sesión.`
            });
        }

        // Releemos el estado real tras el intento de sync
        let isOK = false;
        try {
            const res = await fetch(`/api/accounts?platform=${group.platform}`);
            const data = await res.json();
            const updated = data.find((a: any) => a.id === group.accountId);
            isOK = updated?.sync_status === "OK";
            setAccountGroups(prev => prev.map(g => g.key === group.key
                ? { ...g, isSyncing: false, isSynced: isOK, account_name: updated?.account_name ?? g.account_name }
                : g
            ));
        } catch (e) {
            console.error(`Error recargando cuenta de ${group.platform}:`, e);
            setAccountGroups(prev => prev.map(g => g.key === group.key ? { ...g, isSyncing: false, isSynced: false } : g));
        }

        return isOK;
    };

    const handleSyncAllPending = async () => {
        const pending = accountGroups.filter(g => !g.isSynced && !g.isSyncing);
        for (const group of pending) {
            await syncOne(group);
        }
    };

    const allSynced = accountGroups.length > 0 && accountGroups.every(g => g.isSynced);
    const canDelete = (accountGroups.length === 0 || allSynced) && !isLoading;
    const pendingCount = accountGroups.filter(g => !g.isSynced).length;
    const anySyncing = accountGroups.some(g => g.isSyncing);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="!max-w-[560px] w-full p-0 rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-200">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="bg-red-100 text-red-600 p-2.5 rounded-xl">
                                <AlertTriangle size={22} />
                            </div>
                            <DialogTitle className="text-xl font-bold text-gray-800">
                                ¿Eliminar {publications.length} publicaciones?
                            </DialogTitle>
                        </div>
                    </DialogHeader>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col gap-4">
                    {/* Lista de cuentas a sincronizar */}
                    {loadingAccounts && (
                        <div className="flex items-center justify-center py-4 text-gray-500 text-sm gap-2">
                            <Loader2 className="animate-spin h-4 w-4" />
                            Comprobando cuentas implicadas…
                        </div>
                    )}

                    {!loadingAccounts && accountGroups.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-gray-600">
                                    {pendingCount > 0
                                        ? `${pendingCount} de ${accountGroups.length} cuenta(s) por sincronizar`
                                        : `${accountGroups.length} cuenta(s) sincronizada(s)`}
                                </p>
                                {pendingCount > 0 && (
                                    <button
                                        onClick={handleSyncAllPending}
                                        disabled={anySyncing}
                                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Sincronizar todas
                                    </button>
                                )}
                            </div>

                            <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
                                {accountGroups.map((group) => (
                                    <div
                                        key={group.key}
                                        className={`flex items-center justify-between px-4 py-3 ${group.isSynced ? 'bg-green-50/50' : 'bg-yellow-50/50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${group.isSyncing
                                                ? 'text-blue-500'
                                                : group.isSynced
                                                    ? 'text-green-500'
                                                    : 'text-yellow-500'
                                                }`}>
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
                                                        {" "}· {PLATFORM_NAMES[group.platform] || group.platform}
                                                    </span>
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {group.publicationCount} publicación(es)
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => syncOne(group)}
                                            disabled={group.isSyncing}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition disabled:opacity-50 disabled:cursor-not-allowed ${group.isSynced
                                                ? 'bg-white text-green-700 border border-green-300 hover:bg-green-100'
                                                : 'bg-yellow-500 text-white hover:bg-yellow-600'
                                                }`}
                                        >
                                            {group.isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                            {group.isSynced ? 'Resincronizar' : 'Sincronizar'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {freePublicationsCount > 0 && (
                        <p className="text-xs text-gray-400">
                            {freePublicationsCount} publicación(es) más no requieren sincronización de cuenta.
                        </p>
                    )}

                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
                        <Trash2 size={18} className="text-red-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-red-800 leading-relaxed">
                            <span className="font-semibold">Esta acción eliminará permanentemente {publications.length} publicación(es)</span>{" "}
                            en sus respectivos marketplaces. No podrás recuperarlas.
                        </p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                        <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-amber-800 leading-relaxed">
                            Solo se eliminarán las publicaciones en sus marketplaces.
                            Los productos en ReventaLibertad no se verán afectados.
                        </p>
                    </div>
                </div>

                <div className="px-6 pb-6 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={!canDelete || loadingAccounts}
                        title={!canDelete ? "Sincroniza todas las cuentas antes de eliminar" : undefined}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading && <Loader2 className="animate-spin h-4 w-4" />}
                        {isLoading ? 'Eliminando...' : `Eliminar ${publications.length} publicación(es)`}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}