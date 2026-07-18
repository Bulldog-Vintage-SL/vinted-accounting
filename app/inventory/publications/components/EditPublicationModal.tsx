"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Loader2, RefreshCw, CheckCircle2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import {
    syncVintedAccount,
    syncWallapopAccount,
    syncVestiaireAccount,
    getVintedItem,
    getWallapopItem,
    updateVintedItem,
    updateWallapopItem,
    updateVestiaireItem,
} from '@/lib/external-integrations/';
import { useToast } from "@/components/toast";
import { Publication } from '../types';

interface Props {
    open: boolean;
    onClose: () => void;
    onUpdated: () => void;
    publication: Publication | null;
}

const PLATFORM_NAMES: Record<string, string> = {
    vinted: "Vinted",
    wallapop: "Wallapop",
    vestiaire: "Vestiaire Collective",
    shopify: "Shopify",
};

const SHOPIFY_STATUS_OPTIONS = [
    { value: "ACTIVE", label: "Activo" },
    { value: "DRAFT", label: "Borrador" },
    { value: "ARCHIVED", label: "Archivado" },
];

interface ItemFields {
    title: string;
    description: string;
    price: string;
}

interface ShopifyFields {
    vendor: string;
    productType: string;
    tags: string;
    status: string;
    sku: string;
}

// Estados del flujo del modal
type Step = "sync" | "edit";

export function EditPublicationModal({
    open,
    onClose,
    onUpdated,
    publication,
}: Props) {
    const { pushToast } = useToast();

    const [step, setStep] = useState<Step>("sync");

    // Estado de la cuenta a sincronizar
    const [accountSynced, setAccountSynced] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [accountName, setAccountName] = useState<string | undefined>(undefined);
    const [accountExternalId, setAccountExternalId] = useState<string | undefined>(undefined);
    const [accountVestiaireId, setAccountVestiaireId] = useState<string | null>(null);

    // Estado de carga de los datos del item desde el marketplace
    const [isLoadingItem, setIsLoadingItem] = useState(false);

    // Campos editables comunes
    const [fields, setFields] = useState<ItemFields>({ title: "", description: "", price: "" });

    // Campos exclusivos de Shopify
    const [shopifyFields, setShopifyFields] = useState<ShopifyFields>({
        vendor: "",
        productType: "",
        tags: "",
        status: "ACTIVE",
        sku: "",
    });

    // Precio original de la publicacion, usado para limitar bajadas de precio en Vestiaire
    const [initialPrice, setInitialPrice] = useState<number | null>(null);

    // Estado de actualizacion final
    const [isUpdating, setIsUpdating] = useState(false);

    const platform = publication?.platform ?? "";
    const platformLabel = PLATFORM_NAMES[platform] || platform;
    const isVestiaire = platform === "vestiaire";
    const isShopify = platform === "shopify";

    useEffect(() => {
        if (!open) return;
        setStep("sync");
        setAccountSynced(false);
        setIsSyncing(false);
        setAccountName(undefined);
        setAccountExternalId(undefined);
        setAccountVestiaireId(null);
        setFields({ title: "", description: "", price: "" });
        setShopifyFields({ vendor: "", productType: "", tags: "", status: "ACTIVE", sku: "" });
        setInitialPrice(publication?.price != null ? Number(publication.price) : null);

        if (!publication) return;

        if (isShopify) {
            fetchShopifyProduct();
            return;
        }

        if (!publication?.account_id || !publication?.platform) return;

        fetch(`/api/accounts?platform=${publication.platform}`)
            .then((res) => res.json())
            .then((data) => {
                const acc = (data || []).find((a: any) => a.id === publication.account_id);
                if (acc?.account_name) setAccountName(acc.account_name);
                if (acc?.external_id) setAccountExternalId(acc.external_id);
                if (acc?.vestiaire_id) setAccountVestiaireId(acc.vestiaire_id);
            })
            .catch((e) => console.error("Error cargando datos de cuenta:", e));
    }, [open, publication?.id]);

    const fetchShopifyProduct = async () => {
        if (!publication) return;
        setIsLoadingItem(true);

        try {
            const res = await fetch(`/api/shopify/get-product?publicationId=${publication.id}`);
            const data = await res.json();

            if (data?.ok && data.product) {
                setFields({
                    title: data.product.title ?? "",
                    description: data.product.descriptionHtml ?? "",
                    price: data.product.price != null ? String(data.product.price) : "",
                });
                setShopifyFields({
                    vendor: data.product.vendor ?? "",
                    productType: data.product.productType ?? "",
                    tags: (data.product.tags ?? []).join(", "),
                    status: data.product.status ?? "ACTIVE",
                    sku: data.product.sku ?? "",
                });
                setStep("edit");
            } else {
                pushToast({
                    type: "error",
                    message: data?.error ?? "No se pudieron obtener los datos del producto",
                });
            }
        } catch (e) {
            console.error("Error obteniendo producto de Shopify:", e);
            pushToast({ type: "error", message: "Error obteniendo los datos del producto" });
        } finally {
            setIsLoadingItem(false);
        }
    };

    const syncAccount = async () => {
        if (!accountExternalId) return null;
        if (platform === "vinted") return syncVintedAccount(accountExternalId);
        if (platform === "wallapop") return syncWallapopAccount(accountExternalId);
        return syncVestiaireAccount(accountExternalId, accountVestiaireId);
    };

    const handleSyncAccount = async () => {
        if (!publication?.account_id || !accountExternalId) return;
        setIsSyncing(true);

        const resSync = await syncAccount();

        if (resSync?.ok) {
            pushToast({ type: "info", message: resSync.message });
        } else {
            pushToast({
                type: "error",
                message: resSync?.message ?? "Error desconocido",
                description: `Intenta recargar la pestaña de ${platformLabel} y ten iniciada la sesión.`,
            });
            setIsSyncing(false);
            return;
        }

        setAccountSynced(true);
        setIsSyncing(false);

        if (isVestiaire) {
            
            setFields({
                title: "",
                description: "",
                price: publication.price != null ? String(publication.price) : "",
            });
            setStep("edit");
        } else {
            await fetchItemFromMarketplace();
        }
    };

    const fetchItemFromMarketplace = async () => {
        if (!publication?.external_id) {
            pushToast({ type: "error", message: "Esta publicación no tiene un id de marketplace asociado" });
            return;
        }
        setIsLoadingItem(true);

        try {
            const getFn = platform === "vinted" ? getVintedItem : getWallapopItem;
            const resItem = await getFn(publication.external_id);

            if (resItem?.ok && resItem.item) {
                setFields({
                    title: resItem.item.title ?? "",
                    description: resItem.item.description ?? "",
                    price: resItem.item.price != null ? String(resItem.item.price) : "",
                });
                setStep("edit");
            } else {
                pushToast({
                    type: "error",
                    message: resItem?.message ?? "No se pudieron obtener los datos de la publicación",
                });
            }
        } catch (e) {
            console.error(`Error obteniendo item de ${platform}:`, e);
            pushToast({ type: "error", message: "Error obteniendo los datos de la publicación" });
        } finally {
            setIsLoadingItem(false);
        }
    };

    const handleUpdate = async () => {
        if (!publication) return;

        const priceNumber = parseFloat(fields.price);
        if (Number.isNaN(priceNumber) || priceNumber <= 0) {
            pushToast({ type: "error", message: "Introduce un precio válido" });
            return;
        }

        if (isVestiaire) {
            if (initialPrice != null && priceNumber >= initialPrice) {
                pushToast({
                    type: "error",
                    message: "En Vestiaire Collective solo puedes bajar el precio",
                    description: `El precio actual es ${initialPrice} €`,
                });
                return;
            }
        } else if (!fields.title.trim()) {
            pushToast({ type: "error", message: "El título no puede estar vacío" });
            return;
        }

        setIsUpdating(true);

        if (isShopify) {
            try {
                const res = await fetch("/api/shopify/update-product", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        publicationId: publication.id,
                        fields: {
                            title: fields.title.trim(),
                            description: fields.description.trim(),
                            price: fields.price,
                            vendor: shopifyFields.vendor.trim(),
                            productType: shopifyFields.productType.trim(),
                            tags: shopifyFields.tags
                                .split(",")
                                .map((t) => t.trim())
                                .filter(Boolean),
                            status: shopifyFields.status,
                            sku: shopifyFields.sku.trim(),
                        },
                    }),
                });
                const data = await res.json();

                if (res.ok && data?.ok) {
                    pushToast({ type: "info", message: "Producto actualizado correctamente en Shopify" });
                    onUpdated();
                    onClose();
                } else {
                    pushToast({ type: "error", message: data?.error ?? "Error actualizando el producto" });
                }
            } catch (e) {
                console.error("Error actualizando producto de Shopify:", e);
                pushToast({ type: "error", message: "Error actualizando el producto" });
            } finally {
                setIsUpdating(false);
            }
            return;
        }

        if (!accountExternalId) {
            pushToast({ type: "error", message: "No se encontró la cuenta vinculada a esta publicación" });
            setIsUpdating(false);
            return;
        }

        const resSync = await syncAccount();

        if (!resSync?.ok) {
            pushToast({
                type: "error",
                message: resSync?.message ?? "No se pudo resincronizar la cuenta",
                description: `Intenta recargar la pestaña de ${platformLabel} y ten iniciada la sesión.`,
            });
            setIsUpdating(false);
            return;
        }

        try {
            let resUpdate;

            if (platform === "vinted") {
                resUpdate = await updateVintedItem(publication.external_id, publication.id, {
                    title: fields.title.trim(),
                    description: fields.description.trim(),
                    price: priceNumber,
                });
            } else if (platform === "wallapop") {
                resUpdate = await updateWallapopItem(publication.external_id, publication.id, {
                    title: fields.title.trim(),
                    description: fields.description.trim(),
                    price: priceNumber,
                });
            } else {
                resUpdate = await updateVestiaireItem(accountExternalId, publication.external_id, publication.id, {
                    title: "",
                    description: "",
                    price: priceNumber,
                });
            }

            if (resUpdate?.ok) {
                pushToast({ type: "info", message: resUpdate.message ?? "Publicación actualizada correctamente" });
                onUpdated();
                onClose();
            } else {
                pushToast({
                    type: "error",
                    message: resUpdate?.message ?? "Error actualizando la publicación",
                });
            }
        } catch (e) {
            console.error(`Error actualizando item de ${platform}:`, e);
            pushToast({ type: "error", message: "Error actualizando la publicación" });
        } finally {
            setIsUpdating(false);
        }
    };

    if (!publication) return null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="!max-w-[560px] w-full p-0 rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-200">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 text-blue-600 p-2.5 rounded-xl">
                                <Pencil size={22} />
                            </div>
                            <DialogTitle className="text-xl font-bold text-gray-800">
                                Editar publicación
                            </DialogTitle>
                        </div>
                    </DialogHeader>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
                    {/* Paso 1: sincronizar cuenta (se omite para Shopify) */}
                    {step === "sync" && !isShopify && (
                        <div className="flex flex-col gap-2">
                            <div
                                className={`flex items-center justify-between px-4 py-3 rounded-xl border ${accountSynced
                                        ? 'bg-green-50/50 border-green-200'
                                        : 'bg-yellow-50/50 border-yellow-200'
                                    }`}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div
                                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isSyncing
                                                ? 'text-blue-500'
                                                : accountSynced
                                                    ? 'text-green-500'
                                                    : 'text-yellow-500'
                                            }`}
                                    >
                                        {isSyncing || isLoadingItem ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : accountSynced ? (
                                            <CheckCircle2 size={16} />
                                        ) : (
                                            <AlertTriangle size={16} />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">
                                            {accountName || "Cuenta sin nombre"}
                                            <span className="text-gray-400 font-normal"> · {platformLabel}</span>
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {isLoadingItem
                                                ? "Obteniendo datos de la publicación…"
                                                : "Sincroniza la cuenta para cargar los datos actuales"}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={handleSyncAccount}
                                    disabled={isSyncing || isLoadingItem}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition disabled:opacity-50 disabled:cursor-not-allowed bg-yellow-500 text-white hover:bg-yellow-600"
                                >
                                    {isSyncing || isLoadingItem ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <RefreshCw size={14} />
                                    )}
                                    Sincronizar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Carga inicial para Shopify (sin paso de sync) */}
                    {step === "sync" && isShopify && (
                        <div className="flex items-center justify-center py-6 gap-2 text-gray-500 text-sm">
                            <Loader2 size={16} className="animate-spin" />
                            Obteniendo datos del producto desde Shopify…
                        </div>
                    )}

                    {/* Paso 2: edicion de campos */}
                    {step === "edit" && (
                        <div className="flex flex-col gap-4">
                            {!isShopify && (
                                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                                    <CheckCircle2 size={14} className="shrink-0" />
                                    Cuenta sincronizada · {accountName || platformLabel}
                                </div>
                            )}

                            {isVestiaire ? (
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700">Precio (€)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={fields.price}
                                        onChange={(e) => setFields((f) => ({ ...f, price: e.target.value }))}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                        placeholder="0.00"
                                    />
                                    <p className="text-xs text-gray-500">
                                        En Vestiaire Collective solo se puede bajar el precio
                                        {initialPrice != null ? ` (precio actual: ${initialPrice} €)` : ""}.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-medium text-gray-700">Título</label>
                                        <input
                                            type="text"
                                            value={fields.title}
                                            onChange={(e) => setFields((f) => ({ ...f, title: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                            placeholder="Título de la publicación"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-medium text-gray-700">Descripción</label>
                                        <textarea
                                            value={fields.description}
                                            onChange={(e) => setFields((f) => ({ ...f, description: e.target.value }))}
                                            rows={4}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                                            placeholder="Descripción de la publicación"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-medium text-gray-700">Precio (€)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={fields.price}
                                            onChange={(e) => setFields((f) => ({ ...f, price: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                            placeholder="0.00"
                                        />
                                    </div>

                                    {/* Campos exclusivos de Shopify */}
                                    {isShopify && (
                                        <>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-medium text-gray-700">SKU</label>
                                                <input
                                                    type="text"
                                                    value={shopifyFields.sku}
                                                    onChange={(e) => setShopifyFields((f) => ({ ...f, sku: e.target.value }))}
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                                    placeholder="SKU"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-sm font-medium text-gray-700">Marca / Vendor</label>
                                                    <input
                                                        type="text"
                                                        value={shopifyFields.vendor}
                                                        onChange={(e) => setShopifyFields((f) => ({ ...f, vendor: e.target.value }))}
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                                        placeholder="Marca"
                                                    />
                                                </div>

                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-sm font-medium text-gray-700">Tipo de producto</label>
                                                    <input
                                                        type="text"
                                                        value={shopifyFields.productType}
                                                        onChange={(e) => setShopifyFields((f) => ({ ...f, productType: e.target.value }))}
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                                        placeholder="Ej. Camisetas"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-medium text-gray-700">Tags (separados por coma)</label>
                                                <input
                                                    type="text"
                                                    value={shopifyFields.tags}
                                                    onChange={(e) => setShopifyFields((f) => ({ ...f, tags: e.target.value }))}
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                                    placeholder="vintage, verano, algodón"
                                                />
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-medium text-gray-700">Estado</label>
                                                <select
                                                    value={shopifyFields.status}
                                                    onChange={(e) => setShopifyFields((f) => ({ ...f, status: e.target.value }))}
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                                                >
                                                    {SHOPIFY_STATUS_OPTIONS.map((opt) => (
                                                        <option key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className="px-6 pb-6 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isUpdating}
                        className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleUpdate}
                        disabled={step !== "edit" || isUpdating}
                        title={step !== "edit" ? "Espera a que se carguen los datos" : undefined}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isUpdating && <Loader2 className="animate-spin h-4 w-4" />}
                        {isUpdating ? 'Actualizando...' : 'Actualizar publicación'}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}