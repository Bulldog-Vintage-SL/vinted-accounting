"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Trash2 } from "lucide-react";

interface Props {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    productName?: string;
}

export function DeleteListingModal({ open, onClose, onConfirm, productName }: Props) {
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="!max-w-[520px] w-full p-0 rounded-2xl overflow-hidden">

                {/* Header */}
                <div className="p-6 border-b border-gray-200">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="bg-red-100 text-red-600 p-2.5 rounded-xl">
                                <AlertTriangle size={22} />
                            </div>
                            <DialogTitle className="text-xl font-bold text-gray-800">
                                ¿Eliminar producto?
                            </DialogTitle>
                        </div>
                    </DialogHeader>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col gap-4">

                    {productName && (
                        <p className="text-sm font-medium text-gray-500">
                            Producto: <span className="text-gray-800 font-semibold">&ldquo;{productName}&rdquo;</span>
                        </p>
                    )}

                    {/* Nota principal */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                        <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-amber-800 leading-relaxed">
                            <span className="font-semibold">Tus publicaciones en los marketplaces no se borrarán.</span>{" "}
                            Solo se desvinculará el producto de ReventaLibertad. Los anuncios en Wallapop, Vinted y otras plataformas seguirán activos.
                        </p>
                    </div>

                    {/* Nota secundaria */}
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
                        <Trash2 size={18} className="text-red-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-red-800 leading-relaxed">
                            Si quieres <span className="font-semibold">borrar también el anuncio en los marketplaces</span>,
                            ve primero a la tabla de <span className="font-semibold">Publicaciones</span> y elimina los anuncios correspondientes antes de borrar el producto.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-all duration-200 text-sm"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => { onConfirm(); onClose(); }}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-sm"
                    >
                        <Trash2 size={15} />
                        Eliminar producto
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
