/*  
  Modal de anyadir un nuevo producto:
    - Crearlo con un form (/new_listing).
    - Importar desde alguna plataforma.
*/

"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, FolderOpen } from "lucide-react";
import { useAccountSelector } from "@/hooks/useAccountSelector";
import { useRouter } from "next/navigation";
import { useQueue } from '@/hooks/useQueue';

interface Props {
    open: boolean;
    onClose: () => void;
}

export function AddListingModal({ open, onClose }: Props) {

    const openSelector = useAccountSelector((s) => s.openSelector);
    const router = useRouter();
    const { enqueue } = useQueue();

    const handleCreate = () => {
        onClose();
        router.push("listings/new_listing");
    };

    const handleImport = () => {
        onClose();

        openSelector((accounts) => {
            if (accounts.length === 0) return

            enqueue('import', accounts, {}, (account) => {
                return `Importar armario de ${account.platform}`
            })
        });
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="!max-w-[700px] w-full p-0 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold text-gray-800">
                            Añadir producto
                        </DialogTitle>
                    </DialogHeader>
                </div>

                <div className="flex flex-row divide-x divide-gray-200">
                    <div className="flex-1 p-8 flex flex-col justify-between hover:bg-gray-50 transition">
                        <div className="flex items-center gap-4">
                            <div className="bg-blue-100 text-blue-600 p-3 rounded-xl">
                                <Upload size={26} />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-gray-800">
                                    Crear producto nuevo
                                </h3>
                                <p className="text-gray-600 text-sm">
                                    Crear un nuevo producto listo para subir a tus plataformas.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleCreate}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 mt-6 self-start"
                        >
                            Subir
                        </button>
                    </div>

                    <div className="flex-1 p-8 flex flex-col justify-between hover:bg-gray-50 transition">
                        <div className="flex items-center gap-4">
                            <div className="bg-blue-100 text-blue-600 p-3 rounded-xl">
                                <FolderOpen size={26} />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-gray-800">
                                    Importar Armario
                                </h3>
                                <p className="text-gray-600 text-sm">
                                    Importa tus productos ya publicados en tus plataformas.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleImport}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 mt-6 self-start"
                        >
                            Importar
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}