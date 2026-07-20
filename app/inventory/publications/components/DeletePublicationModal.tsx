"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Trash2, Loader2, RefreshCw, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { syncVintedAccount, syncWallapopAccount, syncVestiaireAccount } from '@/lib/external-integrations/';
import { useToast } from "@/components/toast";

interface Props {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    publicationTitle?: string;
    platform?: string;
    publicationUrl?: string;
    accountId?: string;
    isLoading?: boolean;
}

const PLATFORM_NAMES: Record<string, string> = {
    vinted: "Vinted",
    wallapop: "Wallapop",
    vestiaire: "Vestiaire Collective",
    shopify: "Shopify",
    depop: "Depop"
};

// Plataformas cuya auth es server-side (OAuth) y no requieren sincronización manual
// mediante la extensión antes de poder operar sobre sus publicaciones.
const NO_SYNC_REQUIRED = new Set(["shopify"]);

export function DeletePublicationModal({
    open,
    onClose,
    onConfirm,
    publicationTitle,
    platform,
    publicationUrl,
    accountId,
    isLoading = false,
}: Props) {
    const { pushToast } = useToast();

    const [account, setAccount] = useState<any>(null);
    const [loadingAccount, setLoadingAccount] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isSynced, setIsSynced] = useState(false);

    const platformLabel = platform ? (PLATFORM_NAMES[platform] || platform) : "el marketplace";
    const skipSync = platform ? NO_SYNC_REQUIRED.has(platform) : false;

    useEffect(() => {
        if (!open) return;

        setAccount(null);
        setIsSyncing(false);

        // Plataformas sin sync manual (ej. Shopify) se consideran listas de inmediato.
        setIsSynced(skipSync);

        if (!platform || !accountId) return;

        setLoadingAccount(true);
        fetch(`/api/accounts?platform=${platform}`)
            .then((res) => res.json())
            .then((data) => {
                const found = data.find((a: any) => a.id === accountId);
                setAccount(found ? { ...found, platform: found.platform || platform } : null);
            })
            .catch((e) => {
                console.error(`Error cargando cuenta de ${platform}:`, e);
            })
            .finally(() => setLoadingAccount(false));
    }, [open, platform, accountId, skipSync]);

    const runSync = (acc: any) => {
        if (acc.platform === "vinted") return syncVintedAccount(acc.external_id);
        if (acc.platform === "wallapop") return syncWallapopAccount(acc.external_id);
        if (acc.platform === "depop") return syncVestiaireAccount(acc.external_id, acc.vestiaire_id ?? null);
    };

    const handleSync = async () => {
        if (!account || skipSync) return;
        setIsSyncing(true);

        const resSync = await runSync(account);

        if (resSync?.ok) {
            pushToast({ type: "info", message: resSync.message });
        } else {
            pushToast({
                type: "error",
                message: resSync?.message ?? "Error desconocido",
                description: `Intenta recargar la pestaña de ${PLATFORM_NAMES[account.platform] || account.platform} y ten iniciada la sesión.`
            });
        }

        try {
            const res = await fetch(`/api/accounts?platform=${platform}`);
            const data = await res.json();
            const updated = data.find((a: any) => a.id === accountId);
            setAccount(updated ? { ...updated, platform: updated.platform || platform } : account);
            setIsSynced(updated?.sync_status === "OK");
        } catch (e) {
            console.error(`Error recargando cuenta de ${platform}:`, e);
            setIsSynced(false);
        }

        setIsSyncing(false);
    };

    const canDelete = isSynced && !isLoading;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="!max-w-[520px] w-full p-0 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="bg-red-100 text-red-600 p-2.5 rounded-xl">
                                <AlertTriangle size={22} />
                            </div>
                            <DialogTitle className="text-xl font-bold text-gray-800">
                                ¿Eliminar publicación?
                            </DialogTitle>
                        </div>
                    </DialogHeader>
                </div>

                <div className="p-6 flex flex-col gap-4">
                    {publicationTitle && (
                        <p className="text-sm font-medium text-gray-500">
                            Publicación: <span className="text-gray-800 font-semibold">&ldquo;{publicationTitle}&rdquo;</span>
                        </p>
                    )}
                    {platform && (
                        <p className="text-sm font-medium text-gray-500">
                            Plataforma: <span className="text-gray-800 font-semibold">{platformLabel}</span>
                        </p>
                    )}
                    {publicationUrl && (
                        <a
                            href={publicationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                        >
                            Ver publicación
                        </a>
                    )}

                    {/* Bloque de sincronización — se omite para plataformas con auth
                        server-side (Shopify), que están siempre listas. */}
                    {!skipSync && (
                        <div className={`rounded-xl p-4 flex items-center gap-3 border ${
                            isSynced ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
                        }`}>
                            <div className={`shrink-0 ${isSynced ? 'text-green-500' : 'text-yellow-500'}`}>
                                {isSyncing ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : isSynced ? (
                                    <CheckCircle2 size={18} />
                                ) : (
                                    <AlertTriangle size={18} />
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className={`text-sm leading-relaxed ${isSynced ? 'text-green-800' : 'text-yellow-800'}`}>
                                    {loadingAccount
                                        ? 'Comprobando estado de la cuenta…'
                                        : isSynced
                                            ? 'Cuenta sincronizada. Ya puedes eliminar la publicación.'
                                            : 'Debes sincronizar la cuenta antes de poder eliminar esta publicación.'}
                                </p>
                                {account?.account_name && (
                                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                                        Cuenta: {account.account_name}
                                    </p>
                                )}
                            </div>

                            <button
                                onClick={handleSync}
                                disabled={isSyncing || loadingAccount || !account}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition disabled:opacity-50 disabled:cursor-not-allowed ${
                                    isSynced
                                        ? 'bg-white text-green-700 border border-green-300 hover:bg-green-100'
                                        : 'bg-yellow-500 text-white hover:bg-yellow-600'
                                }`}
                            >
                                {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                {isSynced ? 'Resincronizar' : 'Sincronizar'}
                            </button>
                        </div>
                    )}

                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
                        <Trash2 size={18} className="text-red-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-red-800 leading-relaxed">
                            <span className="font-semibold">Esta acción eliminará permanentemente la publicación</span>{" "}
                            en <span className="font-semibold">{platformLabel}</span>.
                            No podrás recuperarla.
                        </p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                        <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-amber-800 leading-relaxed">
                            Solo se eliminará la publicación en el marketplace.
                            El producto en ReventaLibertad no se verá afectado.
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
                        disabled={!canDelete}
                        title={!isSynced ? "Sincroniza la cuenta antes de eliminar" : undefined}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading && <Loader2 className="animate-spin h-4 w-4" />}
                        {isLoading ? 'Eliminando...' : 'Eliminar publicación'}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}