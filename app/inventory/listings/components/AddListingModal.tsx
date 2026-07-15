/*  
  Modal de anyadir un nuevo producto:
    - Crearlo con un form (/new_listing).
    - Importar desde alguna plataforma.
*/

"use client";

import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, FolderOpen, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueue } from '@/hooks/useQueue';
import { SelectedAccount, useAccountSelector } from '@/hooks/useAccountSelector'
import { LoadingButton } from "@/components/ui/loading-button";
import type { Job, JobStatus } from '@/lib/queue/types';

interface Props {
    open: boolean;
    onClose: () => void;
}

type ImportPhase = 'idle' | 'importing' | 'done';

export function AddListingModal({ open, onClose }: Props) {

    const openSelector = useAccountSelector((s) => s.openSelector);
    const selectorOpen = useAccountSelector((s) => s.open);
    const router = useRouter();
    const { enqueue, onEvent } = useQueue<SelectedAccount>();
    const [isImporting, setIsImporting] = useState(false);

    const [importPhase, setImportPhase] = useState<ImportPhase>('idle');
    const jobsRef = useRef<Job<'import', SelectedAccount>[]>([]);
    const [, forceTick] = useState(0);

    useEffect(() => {
        if (selectorOpen) {
            setIsImporting(false);
        }
    }, [selectorOpen]);

    useEffect(() => {
        if (!open) {
            setIsImporting(false);

            if (importPhase === 'done') {
                setImportPhase('idle');
                jobsRef.current = [];
            }
        }
    }, [open, importPhase]);

    // Escuchamos eventos de la cola mientras estamos importando
    useEffect(() => {
        if (importPhase !== 'importing') return;

        const unsubscribe = onEvent(() => {
            forceTick((t) => t + 1);

            const allDone = jobsRef.current.every(
                (j) => j.status === 'completed' || j.status === 'failed'
            );
            if (allDone && jobsRef.current.length > 0) {
                setImportPhase('done');
            }
        });

        return unsubscribe;
    }, [importPhase, onEvent]);

    const handleCreate = () => {
        onClose();
        router.push("listings/new_listing");
    };

    const handleImport = () => {
        setIsImporting(true);

        openSelector((accounts) => {
            setIsImporting(false);

            if (accounts.length === 0) return;

            const jobs = enqueue('import', accounts, {}, (account) => {
                return `Importar armario de ${account.platform}`;
            });

            jobsRef.current = jobs;
            setImportPhase('importing');
        });
    };

    // Bloqueamos el cierre del modal
    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen && importPhase === 'importing') return;
        if (!nextOpen) onClose();
    };

    const handleFinish = () => {
        setImportPhase('idle');
        jobsRef.current = [];
        onClose();
    };

    const isBusy = importPhase === 'importing';

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className="!max-w-[700px] w-full p-0 rounded-2xl overflow-hidden"
                onPointerDownOutside={(e) => { if (isBusy) e.preventDefault(); }}
                onEscapeKeyDown={(e) => { if (isBusy) e.preventDefault(); }}
                showCloseButton={importPhase !== 'importing'}
            >
                {importPhase === 'idle' && (
                    <>
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
                                <LoadingButton
                                    onClick={handleImport}
                                    loading={isImporting}
                                    loadingText="Abriendo selector..."
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 mt-6 self-start"
                                >
                                    Importar
                                </LoadingButton>
                            </div>
                        </div>
                    </>
                )}

                {(importPhase === 'importing' || importPhase === 'done') && (
                    <div className="p-8">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-bold text-gray-800 mb-1">
                                {importPhase === 'importing' ? 'Importando armario...' : '¡Importación completada!'}
                            </DialogTitle>
                            <p className="text-gray-600 text-sm mb-6">
                                {importPhase === 'importing'
                                    ? 'No cierres esta ventana mientras se importan tus cuentas.'
                                    : 'Ya puedes cerrar esta ventana.'}
                            </p>
                        </DialogHeader>

                        <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto pr-1">
                            {jobsRef.current.map((job) => (
                                <div
                                    key={job.id}
                                    className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3"
                                >
                                    <span className="text-gray-800 font-medium">
                                        {job.entityLabel}
                                    </span>
                                    <JobStatusBadge status={job.status} />
                                </div>
                            ))}
                        </div>

                        {importPhase === 'done' && (
                            <button
                                onClick={handleFinish}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 mt-6"
                            >
                                Cerrar
                            </button>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function JobStatusBadge({ status }: { status: JobStatus }) {
    switch (status) {
        case 'completed':
            return (
                <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                    <CheckCircle2 size={18} /> Completado
                </span>
            );
        case 'failed':
            return (
                <span className="flex items-center gap-1.5 text-red-600 text-sm font-medium">
                    <XCircle size={18} /> Error
                </span>
            );
        case 'processing':
            return (
                <span className="flex items-center gap-1.5 text-blue-600 text-sm font-medium">
                    <Loader2 size={18} className="animate-spin" /> Importando...
                </span>
            );
        case 'retrying':
            return (
                <span className="flex items-center gap-1.5 text-amber-600 text-sm font-medium">
                    <Loader2 size={18} className="animate-spin" /> Reintentando...
                </span>
            );
        default:
            return (
                <span className="text-gray-400 text-sm font-medium">
                    En cola
                </span>
            );
    }
}