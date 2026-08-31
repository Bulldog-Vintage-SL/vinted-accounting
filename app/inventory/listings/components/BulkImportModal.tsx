"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Scissors, Sparkles, X, XCircle, Rocket, Save } from "lucide-react";
import { uploadPhoto } from "@/utils/uploadPhoto";
import type { Listing, ListingForm } from "@/app/inventory/listings/types";
import { useAccountSelector, SelectedAccount } from "@/hooks/useAccountSelector";
import { useQueue } from "@/hooks/useQueue";
import { PublishProgressModal } from "@/app/inventory/listings/components/PublishProgressModal";
import { applyFieldPatch } from "@/lib/external-integrations/validators";
import BrandSelect from "@/app/inventory/listings/new_listing/components/BrandSelector";
import CategorySelect from "@/app/inventory/listings/new_listing/components/CategorySelect";
import { useToast } from "@/components/toast";
import type { Job } from "@/lib/queue/types";

type Phase = "upload" | "group" | "publish-choice" | "generating" | "review" | "publishing";

const GROUP_STYLES = [
    { ring: "ring-purple-400", chip: "bg-purple-600" },
    { ring: "ring-blue-400", chip: "bg-blue-600" },
    { ring: "ring-emerald-400", chip: "bg-emerald-600" },
    { ring: "ring-amber-400", chip: "bg-amber-600" },
    { ring: "ring-pink-400", chip: "bg-pink-600" },
    { ring: "ring-cyan-400", chip: "bg-cyan-600" },
];

interface DraftListing {
    id: string;
    photos: string[];
    data: Partial<ListingForm> | Listing | null;
    status: "pending" | "generating" | "done" | "error";
    error?: string;
}

type UploadJob = {
    listing: Listing;
    account: SelectedAccount;
};

interface Props {
    open: boolean;
    onClose: () => void;
    onSaveListing: (data: ListingForm) => Promise<Listing>;
}

// eslint-disable-next-line no-undef
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 4): Promise<Response> {
    let attempt = 0;

    while (true) {
        const res = await fetch(url, options);

        if (res.status !== 429) return res;

        attempt++;
        if (attempt > maxRetries) return res;

        const bodyText = await res.clone().text();
        const match = bodyText.match(/try again in ([\d.]+)s/i);
        const waitMs = match
            ? Math.ceil(parseFloat(match[1]) * 1000) + 250
            : 1000 * attempt;

        await new Promise(resolve => setTimeout(resolve, waitMs));
    }
}

export function BulkImportModal({ open, onClose, onSaveListing }: Props) {
    const [phase, setPhase] = useState<Phase>("upload");
    const [photos, setPhotos] = useState<string[]>([]);
    const [boundaries, setBoundaries] = useState<Set<number>>(new Set());
    const [isUploading, setIsUploading] = useState(false);
    const [drafts, setDrafts] = useState<DraftListing[]>([]);
    const [aiSelectedPhotos, setAiSelectedPhotos] = useState<Set<string>>(new Set());
    const [selectedAccounts, setSelectedAccounts] = useState<SelectedAccount[]>([]);
    const [isSaving, setIsSaving] = useState(false);


    const [autoPublish, setAutoPublish] = useState(false);

    const { pushToast } = useToast();
    const openSelector = useAccountSelector(s => s.openSelector);


    const { enqueue, clear, retryJobWithPatch, onEvent } = useQueue<Listing>();
    const [publishJobs, setPublishJobs] = useState<Job<"upload", Listing>[]>([]);
    const [, forceTick] = useState(0);

    const MAX_AI_PHOTOS_PER_ITEM = 3;

    const reset = () => {
        setPhase("upload");
        setPhotos([]);
        setBoundaries(new Set());
        setDrafts([]);
        setAiSelectedPhotos(new Set());
        setSelectedAccounts([]);
        setPublishJobs([]);
        setAutoPublish(false);
    };

    const handleClose = () => {
        if (phase === "generating" || phase === "publishing") return;
        reset();
        onClose();
    };

    const handleFilesSelected = async (files: File[]) => {
        if (files.length === 0) return;
        setIsUploading(true);
        try {
            const urls = await Promise.all(files.map(uploadPhoto));
            setPhotos(prev => [...prev, ...urls]);
        } finally {
            setIsUploading(false);
        }
    };

    const toggleBoundary = (index: number) => {
        setBoundaries(prev => {
            const next = new Set(prev);
            next.has(index) ? next.delete(index) : next.add(index);
            return next;
        });
    };

    const buildGroups = (): string[][] => {
        const groups: string[][] = [];
        let current: string[] = [];
        photos.forEach((url, i) => {
            current.push(url);
            if (boundaries.has(i) || i === photos.length - 1) {
                groups.push(current);
                current = [];
            }
        });
        return groups.filter(g => g.length > 0);
    };

    const buildPhotoGroupIndex = (): number[] => {
        const indices: number[] = [];
        let current = 0;
        photos.forEach((_, i) => {
            indices.push(current);
            if (boundaries.has(i)) current++;
        });
        return indices;
    };

    const toggleAiPhoto = (url: string, groupNumber: number, photoGroupIndex: number[]) => {
        setAiSelectedPhotos(prev => {
            const next = new Set(prev);

            if (next.has(url)) {
                next.delete(url);
                return next;
            }

            const countInGroup = photos.filter((p, idx) => prev.has(p) && photoGroupIndex[idx] === groupNumber).length;
            if (countInGroup >= MAX_AI_PHOTOS_PER_ITEM) return prev; // límite alcanzado para esta prenda

            next.add(url);
            return next;
        });
    };


    const handleWantsToPublish = () => {
        openSelector((accounts) => {
            if (accounts.length === 0) return;
            setSelectedAccounts(accounts);
            handleGenerate(buildGroups(), accounts);
        });
    };

    const handleSkipPublish = () => {
        setSelectedAccounts([]);
        handleGenerate(buildGroups(), []);
    };

    const handleGenerate = async (groups: string[][], accountsForRun: SelectedAccount[]) => {
        if (groups.length === 0) return;


        let workingDrafts: DraftListing[] = groups.map((g, i) => ({
            id: `draft-${i}-${Date.now()}`,
            photos: g,
            data: null,
            status: "pending",
        }));
        setDrafts(workingDrafts);
        setPhase("generating");

        for (const draft of workingDrafts) {
            workingDrafts = workingDrafts.map(d => d.id === draft.id ? { ...d, status: "generating" } : d);
            setDrafts(workingDrafts);

            try {
                const selectedInGroup = draft.photos.filter(url => aiSelectedPhotos.has(url));
                const imgUrls = (selectedInGroup.length > 0 ? selectedInGroup : draft.photos).slice(0, MAX_AI_PHOTOS_PER_ITEM);

                const res = await fetchWithRetry("/api/field-suggestions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        imgUrls,
                        suggestSizeCondition: true,
                        k: 5,
                    }),
                });

                if (res.status === 429) {
                    throw new Error("Límite de peticiones a la IA alcanzado, inténtalo de nuevo en unos segundos");
                }
                if (!res.ok) throw new Error(await res.text());

                const suggestion = await res.json();

                const generatedData: Partial<ListingForm> = {
                    title: suggestion.title ?? "",
                    description: suggestion.description ?? "",
                    price: typeof suggestion.price === "number" ? suggestion.price : 0,
                    gender: suggestion.gender,
                    colors: Array.isArray(suggestion.colors) ? suggestion.colors : [],
                    condition: suggestion.condition ?? "Bueno",
                    photo_url: draft.photos,
                    stock: 1,
                    item_type: suggestion.category?.title ?? "",
                    attributes: {
                        brand: suggestion.brand ?? "Sin marca",
                        categoryPath: suggestion.category?.path ?? "",
                        vintedCategoryId: suggestion.category?.id ?? null,
                        size: suggestion.size ?? "",
                    },
                };

                workingDrafts = workingDrafts.map(d => d.id === draft.id ? {
                    ...d,
                    status: "done",
                    data: generatedData,
                } : d);
                setDrafts(workingDrafts);
            } catch (err) {
                workingDrafts = workingDrafts.map(d => d.id === draft.id ? {
                    ...d, status: "error", error: err instanceof Error ? err.message : "Error desconocido",
                } : d);
                setDrafts(workingDrafts);
            }

            // pequeño respiro entre productos para no comerte el TPM de golpe
            await new Promise(resolve => setTimeout(resolve, 400));
        }

        setPhase("review");

        if (autoPublish && accountsForRun.length > 0) {
            handleSaveAll(workingDrafts, accountsForRun);
        }
    };

    const updateDraft = (id: string, patch: Partial<ListingForm>) => {
        setDrafts(prev => prev.map(d => {
            if (d.id !== id) return d;
            const base = (d.data ?? {}) as Partial<ListingForm>;
            return { ...d, data: { ...base, ...patch } as Partial<ListingForm> };
        }));
    };
    const updateDraftAttribute = (id: string, patch: Partial<ListingForm["attributes"]>) => {
        setDrafts(prev => prev.map(d => {
            if (d.id !== id) return d;
            const base = (d.data ?? {}) as Partial<ListingForm>;
            return {
                ...d,
                data: {
                    ...base,
                    attributes: { ...(base.attributes ?? {}), ...patch },
                } as Partial<ListingForm>,
            };
        }));
    };

    const handleSaveAll = async (sourceDrafts?: DraftListing[], accountsOverride?: SelectedAccount[]) => {
        if (isSaving) return;
        setIsSaving(true);

        try {
            const list = sourceDrafts ?? drafts;
            const accounts = accountsOverride ?? selectedAccounts;

            const readyDrafts = list.filter(d => d.status === "done" && d.data);
            if (readyDrafts.length === 0) return;

            const createdListings: { draft: DraftListing; listing: Listing }[] = [];

            for (const draft of readyDrafts) {
                try {
                    const createdListing = await onSaveListing(draft.data as ListingForm);

                    if (!createdListing?.id) {
                        throw new Error("El guardado no devolvió el producto creado (sin id)");
                    }

                    createdListings.push({ draft, listing: createdListing });
                } catch (err) {
                    console.error("Error creando listing:", err);
                    pushToast({ type: "error", message: `No se pudo crear "${draft.data?.title ?? "producto"}"` });
                }
            }

            if (createdListings.length === 0) {
                pushToast({ type: "error", message: "No se pudo crear ningún producto" });
                return;
            }

            if (accounts.length === 0) {
                pushToast({
                    type: "success",
                    message: "Productos guardados",
                    description: `${createdListings.length} producto(s) creado(s) correctamente.`,
                });
                reset();
                onClose();
                return;
            }

            setPhase("publishing");
            clear();

            const allJobs: UploadJob[] = [];
            for (const { listing } of createdListings) {
                for (const account of accounts) {
                    allJobs.push({ listing, account });
                }
            }

            const jobs = enqueue("upload", allJobs as unknown as Listing[], {}, (item) => {
                const { listing, account } = item as unknown as UploadJob;
                return `${listing.title ?? "Producto"} en ${account.platform}`;
            });

            setPublishJobs(jobs);
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        if (phase !== "publishing") return;
        const unsubscribe = onEvent(() => forceTick(t => t + 1));
        return unsubscribe;
    }, [phase, onEvent]);

    const handleClosePublishModal = () => {
        reset();
        onClose();
    };

    return (
        <>
            <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
                <DialogContent
                    className="!max-w-[1100px] w-full max-h-[90vh] p-0 rounded-2xl overflow-hidden flex flex-col transition-all duration-200"
                    showCloseButton={phase !== "generating" && phase !== "publishing"}
                >
                    {/* FASE 1: subir fotos */}
                    {phase === "upload" && (
                        <div className="p-6 overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-bold text-gray-800">
                                    Sube todas las fotos
                                </DialogTitle>
                                <p className="text-gray-600 text-sm mt-1">
                                    Mezcla las fotos de todos los productos que quieras dar de alta, luego las agrupamos.
                                </p>
                            </DialogHeader>

                            <div className="grid grid-cols-6 gap-3 mt-4 max-h-[60vh] overflow-y-auto pr-1">
                                {photos.map((url, i) => (
                                    <div key={i} className="relative group">
                                        <img src={url} className="rounded-md shadow-sm object-cover h-32 w-full" />
                                        <button
                                            onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                                            className="absolute top-1 right-1 bg-black/60 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}

                                <label className={`flex items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition ${isUploading ? "opacity-50 pointer-events-none" : ""}`}>
                                    {isUploading ? <Loader2 size={22} className="animate-spin text-gray-400" /> : <span className="text-gray-400 text-3xl">+</span>}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        disabled={isUploading}
                                        onChange={e => { handleFilesSelected(Array.from(e.target.files || [])); e.target.value = ""; }}
                                    />
                                </label>
                            </div>

                            <button
                                onClick={() => setPhase("group")}
                                disabled={photos.length === 0}
                                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-2 rounded-lg mt-6 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Continuar ({photos.length} fotos)
                            </button>
                        </div>
                    )}

                    {/* FASE 2: agrupar por producto */}
                    {phase === "group" && (
                        <div className="p-6 overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-bold text-gray-800">
                                    Marca dónde empieza cada producto
                                </DialogTitle>
                                <p className="text-gray-600 text-sm mt-1">
                                    Pulsa las tijeras entre dos fotos para separar un producto del siguiente.
                                </p>
                            </DialogHeader>

                            <p className="text-xs text-gray-500 mt-1">
                                Solo las fotos marcadas con <span className="font-medium text-purple-600">IA</span> se enviarán para generar los datos de cada prenda (máx. {MAX_AI_PHOTOS_PER_ITEM} por prenda).
                            </p>

                            <div className="flex flex-wrap items-start gap-2 mt-3 max-h-[60vh] overflow-y-auto pr-1 pt-1">
                                {(() => {
                                    const photoGroupIndex = buildPhotoGroupIndex();

                                    return photos.map((url, i) => {
                                        const groupNumber = photoGroupIndex[i];
                                        const style = GROUP_STYLES[groupNumber % GROUP_STYLES.length];
                                        const isSelected = aiSelectedPhotos.has(url);
                                        const countInGroup = photos.filter((p, idx) => aiSelectedPhotos.has(p) && photoGroupIndex[idx] === groupNumber).length;
                                        const isDisabled = !isSelected && countInGroup >= MAX_AI_PHOTOS_PER_ITEM;
                                        const selectionOrder = photos
                                            .filter((p, idx) => aiSelectedPhotos.has(p) && photoGroupIndex[idx] === groupNumber)
                                            .indexOf(url);

                                        return (
                                            <div key={i} className="flex items-start">
                                                <div className={`relative rounded-md ring-2 ring-offset-1 ${style.ring}`}>
                                                    <img src={url} className="rounded-md object-cover h-32 w-32" />

                                                    <button
                                                        type="button"
                                                        onClick={() => toggleAiPhoto(url, groupNumber, photoGroupIndex)}
                                                        disabled={isDisabled}
                                                        title={isSelected ? "Quitar de selección IA" : "Enviar a la IA"}
                                                        className={`absolute bottom-1.5 left-1.5 flex items-center justify-center h-7 w-7 rounded-full text-xs font-medium border transition
                                                            ${isSelected ? "bg-purple-600 text-white border-purple-600" : "bg-white/90 text-gray-600 border-gray-300"}
                                                            ${isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:border-purple-400"}
                                                        `}
                                                    >
                                                        {isSelected ? selectionOrder + 1 : "IA"}
                                                    </button>
                                                </div>

                                                {i < photos.length - 1 && (
                                                    <button
                                                        onClick={() => toggleBoundary(i)}
                                                        title={boundaries.has(i) ? "Unir con el siguiente producto" : "Marcar corte de producto"}
                                                        className={`mx-1.5 flex items-center justify-center h-9 w-9 rounded-full border transition self-center ${boundaries.has(i)
                                                            ? "bg-purple-600 border-purple-600 text-white"
                                                            : "bg-white border-gray-300 text-gray-400 hover:border-purple-400"
                                                            }`}
                                                    >
                                                        <Scissors size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    });
                                })()}
                            </div>

                            <div className="flex items-center gap-2 mt-3 flex-wrap">
                                <p className="text-sm text-gray-500">
                                    {buildGroups().length} producto(s) detectado(s):
                                </p>
                                {buildGroups().map((group, i) => {
                                    const style = GROUP_STYLES[i % GROUP_STYLES.length];
                                    return (
                                        <span key={i} className={`text-xs font-medium text-white px-2 py-0.5 rounded-full ${style.chip}`}>
                                            Producto {i + 1} · {group.length} foto{group.length !== 1 ? "s" : ""}
                                        </span>
                                    );
                                })}
                            </div>

                            <div className="flex gap-3 mt-4">
                                <button onClick={() => setPhase("upload")} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                                    Atrás
                                </button>
                                <button
                                    onClick={() => setPhase("publish-choice")}
                                    disabled={buildGroups().length === 0}
                                    className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Sparkles size={16} /> Continuar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* FASE "publish-choice": ¿publicar ya en alguna plataforma? Si dice
                        que sí, se abre el AccountSelectorModal global. Incluye el switch
                        de auto-publicación tras rellenar los campos. */}
                    {phase === "publish-choice" && (
                        <div className="p-8 flex flex-col items-center text-center">
                            <DialogHeader className="items-center">
                                <DialogTitle className="text-2xl font-bold text-gray-800">
                                    ¿Quieres publicar estos productos ya?
                                </DialogTitle>
                                <p className="text-gray-600 text-sm mt-1 max-w-md">
                                    Puedes publicarlos directamente en tus cuentas de venta, o simplemente guardarlos como borradores en tu inventario.
                                </p>
                            </DialogHeader>

                            <div className="flex flex-col sm:flex-row gap-3 mt-6 w-full max-w-md">
                                <button
                                    onClick={handleWantsToPublish}
                                    className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-3 rounded-lg"
                                >
                                    <Rocket size={16} /> Sí, publicar ahora
                                </button>
                                <button
                                    onClick={handleSkipPublish}
                                    className="flex-1 flex items-center justify-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold px-5 py-3 rounded-lg"
                                >
                                    <Save size={16} /> No, solo guardar
                                </button>
                            </div>

                            <label className="flex items-center gap-3 mt-6 cursor-pointer select-none max-w-md">
                                <span className="relative inline-flex h-6 w-11 shrink-0">
                                    <input
                                        type="checkbox"
                                        checked={autoPublish}
                                        onChange={(e) => setAutoPublish(e.target.checked)}
                                        className="peer sr-only"
                                    />
                                    <span className="absolute inset-0 rounded-full bg-gray-300 peer-checked:bg-purple-600 transition" />
                                    <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                                </span>
                                <span className="text-sm text-gray-600 text-left">
                                    Empezar a publicar automáticamente en cuanto la IA rellene los campos, sin esperar a revisarlos
                                </span>
                            </label>

                            <button onClick={() => setPhase("group")} className="text-sm text-gray-400 hover:text-gray-600 mt-4">
                                Atrás
                            </button>
                        </div>
                    )}

                    {/* FASE 3 y 4: generando / revisar */}
                    {(phase === "generating" || phase === "review") && (
                        <div className="p-6 overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-bold text-gray-800">
                                    {phase === "generating" ? "Generando datos con IA..." : "Revisa antes de guardar"}
                                </DialogTitle>
                                {phase === "review" && selectedAccounts.length > 0 && (
                                    <p className="text-gray-600 text-sm mt-1">
                                        {autoPublish
                                            ? `Publicando automáticamente en ${selectedAccounts.length} cuenta(s): ${selectedAccounts.map(a => a.platform).join(", ")}`
                                            : `Se publicarán en ${selectedAccounts.length} cuenta(s): ${selectedAccounts.map(a => a.platform).join(", ")}`}
                                    </p>
                                )}
                            </DialogHeader>

                            <div className="flex flex-col gap-3 mt-4 max-h-[65vh] overflow-y-auto pr-1">
                                {drafts.map(draft => (
                                    <div key={draft.id} className="flex gap-4 border border-gray-200 rounded-xl p-4">
                                        <img src={draft.photos[0]} className="h-20 w-20 rounded-md object-cover flex-shrink-0" />

                                        <div className="flex-1">
                                            {draft.status === "pending" && <p className="text-sm text-gray-400">En cola...</p>}
                                            {draft.status === "generating" && (
                                                <p className="flex items-center gap-1.5 text-sm text-purple-600">
                                                    <Loader2 size={14} className="animate-spin" /> Analizando {draft.photos.length} foto(s)...
                                                </p>
                                            )}
                                            {draft.status === "error" && (
                                                <p className="flex items-center gap-1.5 text-sm text-red-600">
                                                    <XCircle size={14} /> {draft.error}
                                                </p>
                                            )}
                                            {draft.status === "done" && draft.data && (
                                                <div className="space-y-2">
                                                    <input
                                                        value={draft.data.title ?? ""}
                                                        onChange={e => updateDraft(draft.id, { title: e.target.value })}
                                                        disabled={autoPublish}
                                                        className="w-full font-medium border border-gray-200 rounded p-1.5 text-sm disabled:opacity-60"
                                                    />

                                                    <div className="grid grid-cols-2 gap-2">
                                                        <BrandSelect
                                                            value={draft.data.attributes?.brand}
                                                            onChange={brand => updateDraftAttribute(draft.id, { brand })}
                                                        />
                                                        <CategorySelect
                                                            value={draft.data.attributes?.categoryPath ?? ""}
                                                            unisex={draft.data.gender === "unisex"}
                                                            onChange={({ fullPath, leaf, gender }) => {
                                                                updateDraft(draft.id, {
                                                                    item_type: leaf?.title ?? "",
                                                                    ...(gender ? { gender } : {}),
                                                                });
                                                                updateDraftAttribute(draft.id, {
                                                                    categoryPath: fullPath,
                                                                    vintedCategoryId: leaf?.id ?? null,
                                                                });
                                                            }}
                                                        />
                                                    </div>

                                                    <select
                                                        value={draft.data.attributes?.size ?? ""}
                                                        onChange={e => updateDraftAttribute(draft.id, { size: e.target.value })}
                                                        disabled={autoPublish}
                                                        className="w-full border border-gray-200 rounded p-1.5 text-sm disabled:opacity-60"
                                                    >
                                                        <option value="">Selecciona una talla</option>
                                                        {["XS", "S", "M", "L", "XL", "XXL", "XXXL", "4XL", "5XL", "6XL", "7XL", "8XL", "Talla única"].map(size => (
                                                            <option key={size} value={size}>{size}</option>
                                                        ))}
                                                    </select>

                                                    <div className="relative w-20">
                                                        <input
                                                            type="number"
                                                            value={draft.data.price ?? 0}
                                                            onChange={e =>
                                                                updateDraft(draft.id, {
                                                                    price: Number(e.target.value) || 0
                                                                })
                                                            }
                                                            disabled={autoPublish}
                                                            className="w-full border border-gray-200 rounded p-1.5 pr-6 disabled:opacity-60"
                                                        />
                                                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                                                            €
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {phase === "review" && !autoPublish && (
                                <button
                                    onClick={() => handleSaveAll()}
                                    disabled={isSaving || drafts.every(d => d.status !== "done")}
                                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-2 rounded-lg mt-6 disabled:opacity-40"
                                >
                                    {isSaving && <Loader2 size={14} className="animate-spin" />}
                                    {selectedAccounts.length > 0
                                        ? `Crear y publicar ${drafts.filter(d => d.status === "done").length} producto(s)`
                                        : `Guardar ${drafts.filter(d => d.status === "done").length} producto(s)`}
                                </button>
                            )}

                            {phase === "review" && autoPublish && (
                                <p className="flex items-center gap-1.5 text-sm text-purple-600 mt-6">
                                    <Loader2 size={14} className="animate-spin" /> Publicando automáticamente...
                                </p>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* FASE 5: publicación — solo aparece si se eligieron cuentas; reutiliza
                el mismo modal de progreso que ListingsTable */}
            <PublishProgressModal
                open={phase === "publishing"}
                jobs={publishJobs}
                isBusy={phase === "publishing"}
                onClose={handleClosePublishModal}
                title="Publicando productos..."
                onRetryJob={async (job, patch) => {
                    const uploadJob = job.entity as unknown as UploadJob;
                    const currentData = uploadJob.listing;

                    const formPayload = applyFieldPatch(currentData, patch);

                    try {
                        if (!currentData.id) throw new Error("Producto sin id");

                        const res = await fetch(`/api/listings/${currentData.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(formPayload),
                        });

                        if (!res.ok) {
                            pushToast({ type: "error", message: "Error al guardar" });
                            return;
                        }

                        const updatedListing = await res.json();

                        retryJobWithPatch(job.id, (entity) => {
                            const uj = entity as unknown as UploadJob;
                            return {
                                ...uj,
                                listing: updatedListing,
                            } as unknown as Listing;
                        });
                    } catch (err) {
                        console.error("Error guardando el producto:", err);
                        pushToast({ type: "error", message: "No se pudo conectar con el servidor." });
                    }
                }}
            />
        </>
    );
}