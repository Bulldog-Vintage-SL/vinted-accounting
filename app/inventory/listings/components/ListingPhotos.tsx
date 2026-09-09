"use client";

import { useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function moveItem<T>(items: T[], from: number, to: number): T[] {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
        return items;
    }
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
}

function usePointerReorder(photos: string[], onChange?: (photos: string[]) => void) {
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const dragIndexRef = useRef<number | null>(null);
    const startPosRef = useRef<{ x: number; y: number } | null>(null);
    const didMoveRef = useRef(false);
    const photosRef = useRef(photos);
    const onChangeRef = useRef(onChange);
    photosRef.current = photos;
    onChangeRef.current = onChange;

    const endDrag = () => {
        dragIndexRef.current = null;
        startPosRef.current = null;
        setDragIndex(null);
    };

    const onPointerDown = (index: number) => (e: ReactPointerEvent<HTMLElement>) => {
        if (!onChangeRef.current) return;
        if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragIndexRef.current = index;
        startPosRef.current = { x: e.clientX, y: e.clientY };
        didMoveRef.current = false;
        setDragIndex(index);
    };

    const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
        const from = dragIndexRef.current;
        if (from == null || !startPosRef.current) return;

        const dx = e.clientX - startPosRef.current.x;
        const dy = e.clientY - startPosRef.current.y;
        if (!didMoveRef.current && dx * dx + dy * dy < 16) return;
        didMoveRef.current = true;

        const el = document.elementFromPoint(e.clientX, e.clientY);
        const target = el?.closest("[data-photo-index]") as HTMLElement | null;
        if (!target) return;
        const to = Number(target.dataset.photoIndex);
        if (Number.isNaN(to) || to === from) return;

        const next = moveItem(photosRef.current, from, to);
        dragIndexRef.current = to;
        setDragIndex(to);
        onChangeRef.current?.(next);
    };

    const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
        if (dragIndexRef.current == null) return;
        const moved = didMoveRef.current;
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
            // already released
        }
        endDrag();
        return moved;
    };

    return { dragIndex, didMoveRef, onPointerDown, onPointerMove, onPointerUp };
}

interface SortablePhotoGridProps {
    photos: string[];
    onChange: (photos: string[]) => void;
    onRemove?: (index: number) => void;
    renderOverlay?: (url: string, index: number) => ReactNode;
    trailing?: ReactNode;
    gridClassName?: string;
    imageClassName?: string;
    showPrincipalBadge?: boolean;
}

export function SortablePhotoGrid({
    photos,
    onChange,
    onRemove,
    renderOverlay,
    trailing,
    gridClassName = "grid grid-cols-6 gap-3",
    imageClassName = "rounded-md shadow-sm object-cover h-32 w-full",
    showPrincipalBadge = true,
}: SortablePhotoGridProps) {
    const { dragIndex, onPointerDown, onPointerMove, onPointerUp } = usePointerReorder(photos, onChange);

    return (
        <div className={gridClassName}>
            {photos.map((url, i) => (
                <div
                    key={`${url}-${i}`}
                    data-photo-index={i}
                    onPointerDown={onPointerDown(i)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    className={`relative group cursor-grab active:cursor-grabbing select-none touch-none ${
                        dragIndex === i ? "opacity-60 ring-2 ring-purple-500 rounded-md scale-[0.97]" : ""
                    }`}
                    title="Arrastra la foto a su nueva posición"
                >
                    <img src={url} alt="" draggable={false} className={`${imageClassName} pointer-events-none`} />

                    {showPrincipalBadge && i === 0 && (
                        <span className="absolute top-1 left-1 bg-purple-600 text-white text-[10px] font-medium px-1.5 py-0.5 rounded pointer-events-none">
                            Principal
                        </span>
                    )}

                    {onRemove && (
                        <button
                            type="button"
                            data-no-drag
                            onClick={() => onRemove(i)}
                            className="absolute top-1 right-1 bg-black/60 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition"
                        >
                            <span className="px-1 text-xs">X</span>
                        </button>
                    )}

                    {renderOverlay?.(url, i)}
                </div>
            ))}
            {trailing}
        </div>
    );
}

interface PhotoCarouselProps {
    photos: string[];
    onReorder?: (photos: string[]) => void;
    onZoom: (index: number) => void;
}

export function PhotoCarousel({ photos, onReorder, onZoom }: PhotoCarouselProps) {
    const [index, setIndex] = useState(0);
    const { dragIndex, didMoveRef, onPointerDown, onPointerMove, onPointerUp } = usePointerReorder(photos, onReorder);

    const safeIndex = photos.length === 0 ? 0 : Math.min(index, photos.length - 1);
    const current = photos[safeIndex];

    if (!current) return null;

    const goPrev = () => setIndex((i) => (i - 1 + photos.length) % photos.length);
    const goNext = () => setIndex((i) => (i + 1) % photos.length);

    return (
        <div className="w-44 flex-shrink-0 space-y-2 self-start">
            <div className="relative">
                <button
                    type="button"
                    onClick={() => onZoom(safeIndex)}
                    className="relative block w-full overflow-hidden rounded-md cursor-zoom-in group"
                    title="Ampliar foto"
                >
                    <img src={current} alt="" draggable={false} className="h-44 w-44 object-cover" />
                    <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
                        <ZoomIn size={22} className="text-white opacity-0 group-hover:opacity-100 transition drop-shadow" />
                    </span>
                    {photos.length > 1 && (
                        <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                            {safeIndex + 1}/{photos.length}
                        </span>
                    )}
                </button>

                {photos.length > 1 && (
                    <>
                        <button
                            type="button"
                            onClick={goPrev}
                            className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full h-7 w-7 flex items-center justify-center"
                            title="Foto anterior"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={goNext}
                            className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full h-7 w-7 flex items-center justify-center"
                            title="Foto siguiente"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </>
                )}
            </div>

            {photos.length > 1 && (
                <div className="flex gap-1 overflow-x-auto pb-0.5">
                    {photos.map((url, i) => (
                        <div
                            key={`${url}-${i}`}
                            data-photo-index={i}
                            onPointerDown={onReorder ? onPointerDown(i) : undefined}
                            onPointerMove={onReorder ? onPointerMove : undefined}
                            onPointerUp={onReorder ? (e) => {
                                const moved = onPointerUp(e);
                                if (!moved) setIndex(i);
                            } : () => setIndex(i)}
                            onPointerCancel={onReorder ? onPointerUp : undefined}
                            onClick={() => {
                                if (didMoveRef.current) return;
                                setIndex(i);
                            }}
                            className={`h-10 w-10 rounded overflow-hidden flex-shrink-0 ring-2 transition touch-none select-none ${
                                i === safeIndex ? "ring-purple-500" : "ring-transparent opacity-70 hover:opacity-100"
                            } ${dragIndex === i ? "opacity-50 ring-purple-400" : ""} ${onReorder ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                            title={onReorder ? "Arrastra a su nueva posición" : undefined}
                        >
                            <img src={url} alt="" draggable={false} className="h-full w-full object-cover pointer-events-none" />
                        </div>
                    ))}
                </div>
            )}

            {onReorder && photos.length > 1 && (
                <p className="text-[10px] leading-tight text-gray-400 text-center">
                    Arrastra las miniaturas para reordenar. La primera es la principal.
                </p>
            )}
        </div>
    );
}

interface PhotoLightboxProps {
    photos: string[];
    index: number;
    onIndexChange: (index: number) => void;
    onClose: () => void;
}

export function PhotoLightbox({ photos, index, onIndexChange, onClose }: PhotoLightboxProps) {
    const safeIndex = photos.length === 0 ? 0 : Math.min(index, photos.length - 1);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (photos.length <= 1) return;
            if (e.key === "ArrowLeft") {
                onIndexChange((safeIndex - 1 + photos.length) % photos.length);
            } else if (e.key === "ArrowRight") {
                onIndexChange((safeIndex + 1) % photos.length);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [photos.length, safeIndex, onIndexChange]);

    if (photos.length === 0) return null;

    const goPrev = () => onIndexChange((safeIndex - 1 + photos.length) % photos.length);
    const goNext = () => onIndexChange((safeIndex + 1) % photos.length);

    return (
        <Dialog open={true} onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent
                className="!max-w-4xl w-full p-0 bg-black/95 border-none flex flex-col items-center justify-center"
                showCloseButton
            >
                <div className="relative w-full flex items-center justify-center h-[75vh]">
                    <img
                        src={photos[safeIndex]}
                        alt=""
                        className="max-h-full max-w-full object-contain"
                    />

                    {photos.length > 1 && (
                        <>
                            <button
                                type="button"
                                onClick={goPrev}
                                className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full h-10 w-10 flex items-center justify-center"
                            >
                                <ChevronLeft size={22} />
                            </button>
                            <button
                                type="button"
                                onClick={goNext}
                                className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full h-10 w-10 flex items-center justify-center"
                            >
                                <ChevronRight size={22} />
                            </button>
                            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                                {safeIndex + 1} / {photos.length}
                            </span>
                        </>
                    )}
                </div>

                {photos.length > 1 && (
                    <div className="flex gap-2 pb-4 px-4 overflow-x-auto max-w-full">
                        {photos.map((url, i) => (
                            <button
                                key={`${url}-${i}`}
                                type="button"
                                onClick={() => onIndexChange(i)}
                                className={`h-14 w-14 rounded-md overflow-hidden flex-shrink-0 ring-2 transition ${
                                    i === safeIndex ? "ring-purple-500" : "ring-transparent opacity-60 hover:opacity-100"
                                }`}
                            >
                                <img src={url} alt="" draggable={false} className="h-full w-full object-cover" />
                            </button>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
