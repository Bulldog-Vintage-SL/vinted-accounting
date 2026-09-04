"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";

interface Props {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    listingTitle?: string;
    isLoading?: boolean;
}

export function CancelScheduledUploadModal({ open, onClose, onConfirm, listingTitle, isLoading = false }: Props) {
    return (
        <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !isLoading) onClose(); }}>
            <DialogContent className="!max-w-[480px] w-full p-0 rounded-2xl overflow-hidden">

                {/* Header */}
                <div className="p-6 border-b border-gray-200">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="bg-red-100 text-red-600 p-2.5 rounded-xl">
                                <AlertTriangle size={22} />
                            </div>
                            <DialogTitle className="text-xl font-bold text-gray-800">
                                ¿Cancelar publicación programada?
                            </DialogTitle>
                        </div>
                    </DialogHeader>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col gap-4">

                    {listingTitle && (
                        <p className="text-sm font-medium text-gray-500">
                            Producto: <span className="text-gray-800 font-semibold">&ldquo;{listingTitle}&rdquo;</span>
                        </p>
                    )}

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                        <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-amber-800 leading-relaxed">
                            Se cancelará esta publicación programada y{" "}
                            <span className="font-semibold">no se subirá a las cuentas seleccionadas</span> en
                            la fecha y hora programadas. El producto en sí no se verá afectado.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Volver
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        {isLoading ? "Cancelando..." : "Cancelar publicación"}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}