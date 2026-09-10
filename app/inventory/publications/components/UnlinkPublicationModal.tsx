"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Unlink, Loader2 } from "lucide-react";
import { formatPlatformName } from "@/libs/inventory/display";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  publicationTitle?: string;
  platform?: string;
  count?: number;
  isLoading?: boolean;
}

export function UnlinkPublicationModal({
  open,
  onClose,
  onConfirm,
  publicationTitle,
  platform,
  count = 1,
  isLoading = false,
}: Props) {
  const isBulk = count > 1;
  const platformLabel = formatPlatformName(platform);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isLoading) onClose();
      }}
    >
      <DialogContent className="w-full !max-w-[520px] overflow-hidden rounded-2xl p-0">
        <div className="border-b border-gray-200 p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-orange-100 p-2.5 text-orange-600">
                <Unlink size={22} />
              </div>
              <DialogTitle className="text-xl font-bold text-gray-800">
                {isBulk ? "¿Quitar de la lista?" : "¿Quitar publicación de la lista?"}
              </DialogTitle>
            </div>
          </DialogHeader>
        </div>

        <div className="flex flex-col gap-4 p-6">
          {isBulk ? (
            <p className="text-sm font-medium text-gray-500">
              Se quitarán{" "}
              <span className="font-semibold text-gray-800">{count} publicaciones</span>{" "}
              de ReventaLibertad.
            </p>
          ) : (
            <>
              {publicationTitle && (
                <p className="text-sm font-medium text-gray-500">
                  Publicación:{" "}
                  <span className="font-semibold text-gray-800">&ldquo;{publicationTitle}&rdquo;</span>
                </p>
              )}
              {platform && (
                <p className="text-sm font-medium text-gray-500">
                  Plataforma:{" "}
                  <span className="font-semibold text-gray-800">{platformLabel}</span>
                </p>
              )}
            </>
          )}

          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
            <p className="text-sm leading-relaxed text-amber-800">
              <span className="font-semibold">No se borrará el anuncio en el marketplace.</span>{" "}
              Solo se elimina la fila de aquí. Úsalo si el artículo ya no existe en Vinted,
              Wallapop u otra plataforma y el botón Eliminar falla.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Unlink size={15} />}
            {isLoading ? "Quitando..." : isBulk ? "Quitar de la lista" : "Quitar de la lista"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
