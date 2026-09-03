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
import { useRef } from "react";
import { mutate } from "swr";

type Phase = "upload" | "group" | "details" | "publish-choice" | "generating" | "review" | "publishing";

const GROUP_STYLES = [
    { ring: "ring-purple-400", chip: "bg-purple-600" },
    { ring: "ring-blue-400", chip: "bg-blue-600" },
    { ring: "ring-emerald-400", chip: "bg-emerald-600" },
    { ring: "ring-amber-400", chip: "bg-amber-600" },
    { ring: "ring-pink-400", chip: "bg-pink-600" },
    { ring: "ring-cyan-400", chip: "bg-cyan-600" },
];

const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "4XL", "5XL", "6XL", "7XL", "8XL", "Talla única"];

const DESPERFECTO_OPTIONS = ["Sin desperfectos", "Mancha", "Agujero", "Descosido"] as const;
type Desperfecto = typeof DESPERFECTO_OPTIONS[number];

type GarmentType = "arriba" | "abajo";

interface MedidasArriba {
    axilaAxila: string;
    hombroHombro: string;
    largo: string;
    manga: string;
}

interface MedidasAbajo {
    anchoCintura: string;
    largo: string;
    caderaEntrepierna: string;
    anchoTobillo: string;
}

interface ManualDetails {
    talla: string;
    garmentType: GarmentType | null;
    medidasArriba: MedidasArriba;
    medidasAbajo: MedidasAbajo;
    desperfectos: Desperfecto[];
    sku: string;
    costeInicial: string; // se guarda como string para el input controlado, se parsea a number al enviar
}

const emptyManualDetails = (): ManualDetails => ({
    talla: "",
    garmentType: null,
    medidasArriba: { axilaAxila: "", hombroHombro: "", largo: "", manga: "" },
    medidasAbajo: { anchoCintura: "", largo: "", caderaEntrepierna: "", anchoTobillo: "" },
    desperfectos: [],
    sku: "",
    costeInicial: "",
});

interface DraftListing {
    id: string;
    photos: string[];
    data: Partial<ListingForm> | Listing | null;
    status: "pending" | "generating" | "done" | "error";
    error?: string;
    manual: ManualDetails;
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
    const [selectedAccounts, setSelectedAccounts] = useState<SelectedAccount[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const autoPublishAccountsRef = useRef<SelectedAccount[] | null>(null);
    const [previewDraftId, setPreviewDraftId] = useState<string | null>(null);
    const [previewIndex, setPreviewIndex] = useState(0);

    const [autoPublish, setAutoPublish] = useState(false);

    const { pushToast } = useToast();
    const openSelector = useAccountSelector(s => s.openSelector);

    const { enqueue, clear, retryJobWithPatch, onEvent } = useQueue<Listing>();
    const [publishJobs, setPublishJobs] = useState<Job<"upload", Listing>[]>([]);
    const [, forceTick] = useState(0);

    const reset = () => {
        setPhase("upload");
        setPhotos([]);
        setBoundaries(new Set());
        setDrafts([]);
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

    // Al confirmar el agrupado, se crea un draft por prenda (con todas sus
    // fotos) y se pasa a la fase de detalles manuales antes de llamar a la IA.
    const handleContinueFromGroup = () => {
        const groups = buildGroups();
        if (groups.length === 0) return;

        const initialDrafts: DraftListing[] = groups.map((g, i) => ({
            id: `draft-${i}-${Date.now()}`,
            photos: g,
            data: null,
            status: "pending",
            manual: emptyManualDetails(),
        }));

        setDrafts(initialDrafts);
        setPhase("details");
    };

    const updateManual = (id: string, patch: Partial<ManualDetails>) => {
        setDrafts(prev => prev.map(d => d.id === id ? { ...d, manual: { ...d.manual, ...patch } } : d));
    };

    const updateMedidasArriba = (id: string, patch: Partial<MedidasArriba>) => {
        setDrafts(prev => prev.map(d => d.id === id
            ? { ...d, manual: { ...d.manual, medidasArriba: { ...d.manual.medidasArriba, ...patch } } }
            : d));
    };

    const updateMedidasAbajo = (id: string, patch: Partial<MedidasAbajo>) => {
        setDrafts(prev => prev.map(d => d.id === id
            ? { ...d, manual: { ...d.manual, medidasAbajo: { ...d.manual.medidasAbajo, ...patch } } }
            : d));
    };

    const toggleDesperfecto = (id: string, option: Desperfecto) => {
        setDrafts(prev => prev.map(d => {
            if (d.id !== id) return d;

            let next: Desperfecto[];
            if (option === "Sin desperfectos") {
                next = d.manual.desperfectos.includes("Sin desperfectos") ? [] : ["Sin desperfectos"];
            } else {
                const withoutNone = d.manual.desperfectos.filter(o => o !== "Sin desperfectos");
                next = withoutNone.includes(option)
                    ? withoutNone.filter(o => o !== option)
                    : [...withoutNone, option];
            }

            return { ...d, manual: { ...d.manual, desperfectos: next } };
        }));
    };

    const handleWantsToPublish = () => {
        openSelector((accounts) => {
            if (accounts.length === 0) return;
            setSelectedAccounts(accounts);
            handleGenerate(accounts);
        });
    };

    const handleSkipPublish = () => {
        setSelectedAccounts([]);
        handleGenerate([]);
    };

    // Genera los campos con IA usando exclusivamente la primera foto de cada
    // prenda, más los datos rellenados a mano en la fase "details".
    const handleGenerate = async (accountsForRun: SelectedAccount[]) => {
        if (drafts.length === 0) return;

        setPhase("generating");

        for (const draft of drafts) {
            setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, status: "generating" } : d));

            try {
                const imgUrl = draft.photos[0];
                const medidas = draft.manual.garmentType === "arriba"
                    ? draft.manual.medidasArriba
                    : draft.manual.garmentType === "abajo"
                        ? draft.manual.medidasAbajo
                        : null;

                const res = await fetchWithRetry("/api/field-suggestions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        imgUrl,
                        talla: draft.manual.talla || null,
                        garmentType: draft.manual.garmentType,
                        medidas,
                        desperfectos: draft.manual.desperfectos,
                        sku: draft.manual.sku || "",
                        costeInicial: draft.manual.costeInicial ? Number(draft.manual.costeInicial) : null,
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
                    description: (suggestion.description ?? "").replace(/\\n/g, "\n"),
                    price: typeof suggestion.price === "number" ? suggestion.price : 0,
                    gender: suggestion.gender,
                    colors: Array.isArray(suggestion.colors) ? suggestion.colors : [],
                    condition: suggestion.condition ?? "Bueno",
                    photo_url: draft.photos,
                    stock: 1,
                    item_type: suggestion.category?.title ?? "",
                    sku: draft.manual.sku || "",
                    attributes: {
                        brand: suggestion.brand ?? "Sin marca",
                        categoryPath: suggestion.category?.path ?? "",
                        vintedCategoryId: suggestion.category?.id ?? null,
                        // La talla ya la conocemos del formulario manual, no depende de la IA
                        size: draft.manual.talla || "",
                        garmentType: draft.manual.garmentType,
                        medidas,
                        desperfectos: draft.manual.desperfectos,
                        sku: draft.manual.sku || "",
                        costeInicial: draft.manual.costeInicial ? Number(draft.manual.costeInicial) : null,
                    },
                };

                setDrafts(prev => prev.map(d => d.id === draft.id ? {
                    ...d,
                    status: "done",
                    data: generatedData,
                } : d));
            } catch (err) {
                setDrafts(prev => prev.map(d => d.id === draft.id ? {
                    ...d, status: "error", error: err instanceof Error ? err.message : "Error desconocido",
                } : d));
            }

            // pequeño respiro entre productos para no comerte el TPM de golpe
            await new Promise(resolve => setTimeout(resolve, 400));
        }

        if (autoPublish && accountsForRun.length > 0) {
            autoPublishAccountsRef.current = accountsForRun;
        }
        setPhase("review");
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
                mutate("/api/listings");
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

    useEffect(() => {
        if (phase === "review" && autoPublishAccountsRef.current) {
            const accounts = autoPublishAccountsRef.current;
            autoPublishAccountsRef.current = null;
            handleSaveAll(undefined, accounts);
        }
    }, [phase, drafts]);

    const handleClosePublishModal = () => {
        mutate("/api/listings");
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
                                    Pulsa las tijeras entre dos fotos para separar un producto del siguiente. Solo se usará la primera foto de cada prenda para generar los datos con IA.
                                </p>
                            </DialogHeader>

                            <div className="flex flex-wrap items-start gap-2 mt-3 max-h-[60vh] overflow-y-auto pr-1 pt-1">
                                {(() => {
                                    const photoGroupIndex = buildPhotoGroupIndex();

                                    return photos.map((url, i) => {
                                        const groupNumber = photoGroupIndex[i];
                                        const style = GROUP_STYLES[groupNumber % GROUP_STYLES.length];

                                        return (
                                            <div key={i} className="flex items-start">
                                                <div className={`relative rounded-md ring-2 ring-offset-1 ${style.ring}`}>
                                                    <img src={url} className="rounded-md object-cover h-32 w-32" />
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
                                    onClick={handleContinueFromGroup}
                                    disabled={buildGroups().length === 0}
                                    className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Sparkles size={16} /> Continuar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* FASE "details": datos manuales por prenda antes de llamar a la IA */}
                    {phase === "details" && (
                        <div className="p-6 overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-bold text-gray-800">
                                    Añade los detalles de cada prenda
                                </DialogTitle>
                                <p className="text-gray-600 text-sm mt-1">
                                    Estos datos se usarán junto a la primera foto de cada prenda para generar el título, descripción y precio.
                                </p>
                            </DialogHeader>

                            <div className="flex flex-col gap-4 mt-4 max-h-[65vh] overflow-y-auto pr-1">
                                {drafts.map(draft => (
                                    <div key={draft.id} className="flex gap-4 border border-gray-200 rounded-xl p-4">
                                        <img src={draft.photos[0]} className="h-24 w-24 rounded-md object-cover flex-shrink-0" />

                                        <div className="flex-1 space-y-3">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-xs font-medium text-gray-500">Talla</label>
                                                    <select
                                                        value={draft.manual.talla}
                                                        onChange={e => updateManual(draft.id, { talla: e.target.value })}
                                                        className="w-full border border-gray-200 rounded p-1.5 text-sm mt-0.5"
                                                    >
                                                        <option value="">Selecciona una talla</option>
                                                        {SIZE_OPTIONS.map(size => (
                                                            <option key={size} value={size}>{size}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="text-xs font-medium text-gray-500">SKU</label>
                                                    <input
                                                        value={draft.manual.sku}
                                                        onChange={e => updateManual(draft.id, { sku: e.target.value })}
                                                        placeholder="Ej. AB123"
                                                        className="w-full border border-gray-200 rounded p-1.5 text-sm mt-0.5"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-xs font-medium text-gray-500">Tipo de prenda</label>
                                                <div className="flex gap-2 mt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateManual(draft.id, { garmentType: "arriba" })}
                                                        className={`px-3 py-1.5 rounded-lg text-sm border ${draft.manual.garmentType === "arriba" ? "bg-purple-600 text-white border-purple-600" : "border-gray-300 text-gray-600"}`}
                                                    >
                                                        Arriba
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateManual(draft.id, { garmentType: "abajo" })}
                                                        className={`px-3 py-1.5 rounded-lg text-sm border ${draft.manual.garmentType === "abajo" ? "bg-purple-600 text-white border-purple-600" : "border-gray-300 text-gray-600"}`}
                                                    >
                                                        Abajo
                                                    </button>
                                                </div>
                                            </div>

                                            {draft.manual.garmentType === "arriba" && (
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input
                                                        placeholder="Axila a axila"
                                                        value={draft.manual.medidasArriba.axilaAxila}
                                                        onChange={e => updateMedidasArriba(draft.id, { axilaAxila: e.target.value })}
                                                        className="border border-gray-200 rounded p-1.5 text-sm"
                                                    />
                                                    <input
                                                        placeholder="Hombro a hombro"
                                                        value={draft.manual.medidasArriba.hombroHombro}
                                                        onChange={e => updateMedidasArriba(draft.id, { hombroHombro: e.target.value })}
                                                        className="border border-gray-200 rounded p-1.5 text-sm"
                                                    />
                                                    <input
                                                        placeholder="Largo"
                                                        value={draft.manual.medidasArriba.largo}
                                                        onChange={e => updateMedidasArriba(draft.id, { largo: e.target.value })}
                                                        className="border border-gray-200 rounded p-1.5 text-sm"
                                                    />
                                                    <input
                                                        placeholder="Manga"
                                                        value={draft.manual.medidasArriba.manga}
                                                        onChange={e => updateMedidasArriba(draft.id, { manga: e.target.value })}
                                                        className="border border-gray-200 rounded p-1.5 text-sm"
                                                    />
                                                </div>
                                            )}

                                            {draft.manual.garmentType === "abajo" && (
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input
                                                        placeholder="Ancho cintura"
                                                        value={draft.manual.medidasAbajo.anchoCintura}
                                                        onChange={e => updateMedidasAbajo(draft.id, { anchoCintura: e.target.value })}
                                                        className="border border-gray-200 rounded p-1.5 text-sm"
                                                    />
                                                    <input
                                                        placeholder="Largo"
                                                        value={draft.manual.medidasAbajo.largo}
                                                        onChange={e => updateMedidasAbajo(draft.id, { largo: e.target.value })}
                                                        className="border border-gray-200 rounded p-1.5 text-sm"
                                                    />
                                                    <input
                                                        placeholder="Cadera a entrepierna"
                                                        value={draft.manual.medidasAbajo.caderaEntrepierna}
                                                        onChange={e => updateMedidasAbajo(draft.id, { caderaEntrepierna: e.target.value })}
                                                        className="border border-gray-200 rounded p-1.5 text-sm"
                                                    />
                                                    <input
                                                        placeholder="Ancho tobillo"
                                                        value={draft.manual.medidasAbajo.anchoTobillo}
                                                        onChange={e => updateMedidasAbajo(draft.id, { anchoTobillo: e.target.value })}
                                                        className="border border-gray-200 rounded p-1.5 text-sm"
                                                    />
                                                </div>
                                            )}

                                            <div>
                                                <label className="text-xs font-medium text-gray-500">Desperfectos</label>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {DESPERFECTO_OPTIONS.map(option => {
                                                        const active = draft.manual.desperfectos.includes(option);
                                                        return (
                                                            <button
                                                                key={option}
                                                                type="button"
                                                                onClick={() => toggleDesperfecto(draft.id, option)}
                                                                className={`px-2.5 py-1 rounded-full text-xs border ${active ? "bg-purple-600 text-white border-purple-600" : "border-gray-300 text-gray-600"}`}
                                                            >
                                                                {option}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="w-28">
                                                <label className="text-xs font-medium text-gray-500">Coste inicial</label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        value={draft.manual.costeInicial}
                                                        onChange={e => updateManual(draft.id, { costeInicial: e.target.value })}
                                                        className="w-full border border-gray-200 rounded p-1.5 pr-6 text-sm mt-0.5"
                                                    />
                                                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-sm">
                                                        €
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-3 mt-4">
                                <button onClick={() => setPhase("group")} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                                    Atrás
                                </button>
                                <button
                                    onClick={() => setPhase("publish-choice")}
                                    className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-2 rounded-lg"
                                >
                                    Continuar
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

                            <button onClick={() => setPhase("details")} className="text-sm text-gray-400 hover:text-gray-600 mt-4">
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
                                        <button
                                            type="button"
                                            onClick={() => { setPreviewDraftId(draft.id); setPreviewIndex(0); }}
                                            className="h-20 w-20 rounded-md overflow-hidden flex-shrink-0 relative group cursor-zoom-in"
                                        >
                                            <img src={draft.photos[0]} className="h-full w-full object-cover" />
                                            {draft.photos.length > 1 && (
                                                <span className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[10px] font-medium px-1 rounded">
                                                    +{draft.photos.length - 1}
                                                </span>
                                            )}
                                        </button>

                                        <div className="flex-1">
                                            {draft.status === "pending" && <p className="text-sm text-gray-400">En cola...</p>}
                                            {draft.status === "generating" && (
                                                <p className="flex items-center gap-1.5 text-sm text-purple-600">
                                                    <Loader2 size={14} className="animate-spin" /> Analizando la foto principal...
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

                                                    <textarea
                                                        value={draft.data.description ?? ""}
                                                        onChange={e => updateDraft(draft.id, { description: e.target.value })}
                                                        disabled={autoPublish}
                                                        rows={3}
                                                        placeholder="Descripción del producto..."
                                                        className="w-full border border-gray-200 rounded p-1.5 text-sm resize-none disabled:opacity-60"
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
                                                        {SIZE_OPTIONS.map(size => (
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

            {previewDraftId && (() => {
                const draft = drafts.find(d => d.id === previewDraftId);
                if (!draft) return null;
                const photos = draft.photos;

                const goPrev = () => setPreviewIndex(i => (i - 1 + photos.length) % photos.length);
                const goNext = () => setPreviewIndex(i => (i + 1) % photos.length);

                return (
                    <Dialog open={true} onOpenChange={(next) => { if (!next) setPreviewDraftId(null); }}>
                        <DialogContent
                            className="!max-w-4xl w-full p-0 bg-black/95 border-none flex flex-col items-center justify-center"
                            showCloseButton
                        >
                            <div className="relative w-full flex items-center justify-center h-[75vh]">
                                <img
                                    src={photos[previewIndex]}
                                    className="max-h-full max-w-full object-contain"
                                />

                                {photos.length > 1 && (
                                    <>
                                        <button
                                            onClick={goPrev}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full h-10 w-10 flex items-center justify-center"
                                        >
                                            ‹
                                        </button>
                                        <button
                                            onClick={goNext}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full h-10 w-10 flex items-center justify-center"
                                        >
                                            ›
                                        </button>
                                    </>
                                )}
                            </div>

                            {photos.length > 1 && (
                                <div className="flex gap-2 pb-4 px-4 overflow-x-auto max-w-full">
                                    {photos.map((url, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setPreviewIndex(i)}
                                            className={`h-14 w-14 rounded-md overflow-hidden flex-shrink-0 ring-2 transition ${i === previewIndex ? "ring-purple-500" : "ring-transparent opacity-60 hover:opacity-100"
                                                }`}
                                        >
                                            <img src={url} className="h-full w-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>
                );
            })()}

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