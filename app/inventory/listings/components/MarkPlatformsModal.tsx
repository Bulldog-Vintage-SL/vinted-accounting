"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import {
  PLATFORM_ICONS,
  PLATFORM_ORDER,
  formatPlatformName,
} from "@/libs/inventory/display";

interface Props {
  open: boolean;
  productName?: string;
  selectedPlatforms: string[];
  lockedPlatforms: string[];
  isLoading?: boolean;
  onClose: () => void;
  onSave: (platforms: string[]) => void;
}

export function MarkPlatformsModal({
  open,
  productName,
  selectedPlatforms,
  lockedPlatforms,
  isLoading = false,
  onClose,
  onSave,
}: Props) {
  const [selected, setSelected] = useState<string[]>(selectedPlatforms);
  const discardOnCloseRef = useRef(false);
  const savedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setSelected(selectedPlatforms);
    discardOnCloseRef.current = false;
    savedRef.current = false;
  }, [open, selectedPlatforms]);

  const lockedSet = new Set(lockedPlatforms);

  const togglePlatform = (platform: string) => {
    if (lockedSet.has(platform) || isLoading) return;

    setSelected((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform]
    );
  };

  const handleConfirm = () => {
    savedRef.current = true;
    onSave(selected);
  };

  const handleCancel = () => {
    discardOnCloseRef.current = true;
    onClose();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen || isLoading) return;
    if (discardOnCloseRef.current || savedRef.current) {
      discardOnCloseRef.current = false;
      onClose();
      return;
    }
    handleConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full !max-w-[420px] overflow-hidden rounded-2xl p-0">
        <div className="border-b border-gray-200 p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-800">
              Plataformas publicadas
            </DialogTitle>
          </DialogHeader>
          {productName && (
            <p className="mt-2 text-sm text-gray-500">
              Marca dónde está ya publicado{" "}
              <span className="font-semibold text-gray-800">&ldquo;{productName}&rdquo;</span>
              . No se subirá ni se creará una publicación.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 p-6">
          {PLATFORM_ORDER.map((platform) => {
            const label = formatPlatformName(platform);
            const icon = PLATFORM_ICONS[platform];
            const isSelected = selected.includes(platform);
            const isLocked = lockedSet.has(platform);

            return (
              <button
                key={platform}
                type="button"
                disabled={isLoading || isLocked}
                onClick={() => togglePlatform(platform)}
                aria-pressed={isSelected}
                title={
                  isLocked
                    ? `${label}: publicación real. Quítala desde Publicaciones.`
                    : label
                }
                className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                } ${isLocked ? "cursor-default" : ""}`}
              >
                {icon ? (
                  <img
                    src={icon}
                    alt=""
                    className="h-8 w-8 rounded-md bg-white object-contain"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center text-xs font-semibold text-gray-700">
                    {label.slice(0, 3)}
                  </span>
                )}
                <span className="text-sm font-medium text-gray-800">{label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isLoading}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={15} className="animate-spin" /> : null}
            {isLoading ? "Guardando..." : "Listo"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
