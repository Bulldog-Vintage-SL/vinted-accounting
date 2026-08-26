"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Scissors, Sparkles, X, CheckCircle2, XCircle } from "lucide-react";
import { uploadPhoto } from "@/utils/uploadPhoto";
import type { ListingForm } from "@/app/inventory/listings/types";

type Phase = "upload" | "group" | "generating" | "review";

// Paleta cíclica para distinguir visualmente cada producto en la fase de agrupado
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
    data: Partial<ListingForm> | null;
    status: "pending" | "generating" | "done" | "error";
    error?: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    onSaveListing: (data: ListingForm) => Promise<void>;
}

// Reintenta con backoff ante 429; si el body trae "try again in Xs", espera exactamente eso
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 4): Promise<Response> {
    let attempt = 0;

    while (true) {
        const res = await fetch(url, options);

        if (res.status !== 429) return res;

        attempt++;
        if (attempt > maxRetries) return res; // se acaban los reintentos, dejamos que falle arriba

        const bodyText = await res.clone().text();
        const match = bodyText.match(/try again in ([\d.]+)s/i);
        const waitMs = match
            ? Math.ceil(parseFloat(match[1]) * 1000) + 250 // margen de seguridad
            : 1000 * attempt; // backoff simple si no viene el tiempo exacto

        await new Promise(resolve => setTimeout(resolve, waitMs));
    }
}

export function BulkImportModal({ open, onClose, onSaveListing }: Props) {
    const [phase, setPhase] = useState<Phase>("upload");
    const [photos, setPhotos] = useState<string[]>([]);
    const [boundaries, setBoundaries] = useState<Set<number>>(new Set());
    const [isUploading, setIsUploading] = useState(false);
    const [drafts, setDrafts] = useState<DraftListing[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [aiSelectedPhotos, setAiSelectedPhotos] = useState<Set<string>>(new Set());

    const MAX_AI_PHOTOS_PER_ITEM = 3;

    const reset = () => {
        setPhase("upload");
        setPhotos([]);
        setBoundaries(new Set());
        setDrafts([]);
        setAiSelectedPhotos(new Set());
    };

    const handleClose = () => {
        if (phase === "generating" || isSaving) return; // bloqueamos cierre mientras hay trabajo en curso
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

    // boundary en el índice i = hay un corte entre photos[i] y photos[i+1]
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

    // A qué producto (0, 1, 2...) pertenece cada foto, según los cortes marcados
    const buildPhotoGroupIndex = (): number[] => {
        const indices: number[] = [];
        let current = 0;
        photos.forEach((_, i) => {
            indices.push(current);
            if (boundaries.has(i)) current++;
        });
        return indices;
    };

    // Marca/desmarca una foto para enviar a la IA, respetando el máximo de 3 por prenda
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

    const handleGenerate = async () => {
        const groups = buildGroups();
        if (groups.length === 0) return;

        const initialDrafts: DraftListing[] = groups.map((g, i) => ({
            id: `draft-${i}-${Date.now()}`,
            photos: g,
            data: null,
            status: "pending",
        }));
        setDrafts(initialDrafts);
        setPhase("generating");

        // Secuencial (con retry) para no saturar el TPM del endpoint de sugerencias
        for (const draft of initialDrafts) {
            setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, status: "generating" } : d));

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

                const data = await res.json();

                setDrafts(prev => prev.map(d => d.id === draft.id ? {
                    ...d,
                    status: "done",
                    data: {
                        title: data.title ?? "",
                        description: data.description ?? "",
                        price: typeof data.price === "number" ? data.price : 0,
                        gender: data.gender,
                        colors: Array.isArray(data.colors) ? data.colors : [],
                        condition: data.condition ?? "Bueno",
                        photo_url: draft.photos,
                        stock: 1,
                        item_type: data.category?.title ?? "",
                        attributes: {
                            brand: data.brand ?? "Sin marca",
                            categoryPath: data.category?.path ?? "",
                            vintedCategoryId: data.category?.id ?? null,
                            size: data.size ?? "",
                        },
                    },
                } : d));
            } catch (err) {
                setDrafts(prev => prev.map(d => d.id === draft.id ? {
                    ...d, status: "error", error: err instanceof Error ? err.message : "Error desconocido",
                } : d));
            }

            // pequeño respiro entre productos para no comerte el TPM de golpe
            await new Promise(resolve => setTimeout(resolve, 400));
        }

        setPhase("review");
    };

    const updateDraft = (id: string, patch: Partial<ListingForm>) => {
        setDrafts(prev => prev.map(d => d.id === id ? { ...d, data: { ...d.data, ...patch } } : d));
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        for (const draft of drafts) {
            if (draft.status !== "done" || !draft.data) continue;
            try {
                await onSaveListing(draft.data as ListingForm);
            } catch {
                setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, status: "error", error: "Fallo al guardar" } : d));
            }
        }
        setIsSaving(false);
        reset();
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
            <DialogContent
                className="!max-w-[1100px] w-full max-h-[90vh] p-0 rounded-2xl overflow-hidden flex flex-col transition-all duration-200"
                showCloseButton={phase !== "generating" && !isSaving}
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
                                onClick={handleGenerate}
                                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-2 rounded-lg"
                            >
                                <Sparkles size={16} /> Generar con IA
                            </button>
                        </div>
                    </div>
                )}

                {/* FASE 3 y 4: generando / revisar */}
                {(phase === "generating" || phase === "review") && (
                    <div className="p-6 overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-bold text-gray-800">
                                {phase === "generating" ? "Generando datos con IA..." : "Revisa antes de guardar"}
                            </DialogTitle>
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
                                                    className="w-full font-medium border border-gray-200 rounded p-1.5 text-sm"
                                                />
                                                <div className="relative w-20">
                                                    <input
                                                        type="number"
                                                        value={draft.data.price ?? 0}
                                                        onChange={e =>
                                                            updateDraft(draft.id, {
                                                                price: Number(e.target.value) || 0
                                                            })
                                                        }
                                                        className="w-full border border-gray-200 rounded p-1.5 pr-6"
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

                        {phase === "review" && (
                            <button
                                onClick={handleSaveAll}
                                disabled={isSaving || drafts.every(d => d.status !== "done")}
                                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-2 rounded-lg mt-6 disabled:opacity-40"
                            >
                                {isSaving && <Loader2 size={16} className="animate-spin" />}
                                Guardar {drafts.filter(d => d.status === "done").length} producto(s)
                            </button>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}