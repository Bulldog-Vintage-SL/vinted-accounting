"use client";

import { Check, Clock, Loader2, Minus, RotateCcw, Sparkles, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Job, JobAction } from "@/lib/queue/types";
import type { ReplyChatEntity, ReplyChatResult } from "@/lib/chats/chat-api";

type ReplyJob = Job<JobAction, ReplyChatEntity>;

interface ReplyProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: ReplyJob[];
  onRetryFailed: () => void;
}

function StatusIcon({ job }: { job: ReplyJob }) {
  const skipped = (job.result as ReplyChatResult | undefined)?.skipped;
  switch (job.status) {
    case "processing":
      return <Loader2 className="w-4 h-4 animate-spin text-purple-600" />;
    case "completed":
      return skipped ? (
        <Minus className="w-4 h-4 text-base-content/50" />
      ) : (
        <Check className="w-4 h-4 text-success" />
      );
    case "failed":
      return <X className="w-4 h-4 text-error" />;
    default:
      return <Clock className="w-4 h-4 text-base-content/40" />;
  }
}

function JobDetail({ job }: { job: ReplyJob }) {
  const result = job.result as ReplyChatResult | undefined;

  if (job.status === "failed") {
    return <p className="text-xs text-error mt-0.5">{job.error}</p>;
  }
  if (job.status === "completed") {
    return result?.skipped ? (
      <p className="text-xs text-base-content/50 mt-0.5">Omitido: {result.reason}</p>
    ) : (
      <p className="text-xs text-base-content/60 mt-0.5 line-clamp-2">{result?.reply}</p>
    );
  }
  if (job.status === "processing") {
    return <p className="text-xs text-purple-600 mt-0.5">Generando y enviando respuesta…</p>;
  }
  return <p className="text-xs text-base-content/40 mt-0.5">En cola</p>;
}

export function ReplyProgressModal({
  open,
  onOpenChange,
  jobs,
  onRetryFailed,
}: ReplyProgressModalProps) {
  const total = jobs.length;
  const failed = jobs.filter((j) => j.status === "failed").length;
  const done = jobs.filter((j) => j.status === "completed" || j.status === "failed").length;
  const running = done < total;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[480px] w-full rounded-xl p-0 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-gray-800">
              <Sparkles size={18} className="text-purple-600" />
              Responder con IA
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4">
            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-purple-600 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              {done}/{total} procesados
              {failed > 0 ? ` · ${failed} con error` : ""}
            </p>
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
          {jobs.map((job) => (
            <div key={job.id} className="flex items-start gap-3 px-6 py-3">
              <div className="mt-0.5 shrink-0">
                <StatusIcon job={job} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {job.entityLabel}
                </p>
                <JobDetail job={job} />
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200 flex items-center gap-3">
          {running && (
            <p className="text-xs text-gray-500 flex-1">
              Puedes cerrar: la cola sigue en segundo plano.
            </p>
          )}
          {!running && failed > 0 && (
            <button
              onClick={onRetryFailed}
              className="flex items-center justify-center gap-1.5 flex-1 py-2.5 border border-purple-200 text-purple-600 hover:bg-purple-50 rounded-lg transition font-medium"
            >
              <RotateCcw size={14} />
              Reintentar fallidos
            </button>
          )}
          <button
            onClick={() => onOpenChange(false)}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition font-medium"
          >
            Cerrar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}