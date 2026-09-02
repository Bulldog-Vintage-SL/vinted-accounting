'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, RefreshCw, AlertTriangle } from "lucide-react"
import { syncVintedAccount, syncWallapopAccount, syncVestiaireAccount, syncDepopAccount } from '@/lib/external-integrations/'
import { useToast } from "@/components/toast"
import type { Job, JobStatus } from '@/lib/queue/types'
import { Publication } from '../types'

const PLATFORM_NAMES: Record<string, string> = {
  vinted: "Vinted",
  wallapop: "Wallapop",
  vestiaire: "Vestiaire Collective",
  shopify: "Shopify",
  depop: "Depop"
}

const SYNC_REQUIRED_PLATFORMS = new Set(["vinted", "wallapop", "vestiaire", "depop"])

interface AccountGroup {
  key: string
  accountId: string
  platform: string
  account_name?: string
  external_id?: string
  vestiaire_id?: string | null
  publicationCount: number
  isSynced: boolean
  isSyncing: boolean
}

interface Props<T> {
  open: boolean
  publications: Publication[]
  jobs: Job<'reuploadPublication', T>[]
  isBusy: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  onRetryJob?: (job: Job<'reuploadPublication', T>) => void
}

function ReuploadPublicationProgressModal<T>({
  open,
  publications,
  jobs,
  isBusy,
  onClose,
  onConfirm,
  title,
  onRetryJob,
}: Props<T>) {
  const { pushToast } = useToast()
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)

  // --- Fase de sincronización de cuentas (previa a crear los jobs) ---
  const [accountGroups, setAccountGroups] = useState<AccountGroup[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [syncingAll, setSyncingAll] = useState(false)

  const hasStarted = jobs.length > 0 // una vez hay jobs, ya se confirmó y arrancó la resubida

  const freePublicationsCount = useMemo(
    () => publications.filter(p => !SYNC_REQUIRED_PLATFORMS.has(p.platform) || !p.account_id).length,
    [publications]
  )

  const requiredAccountKeys = useMemo(() => {
    const map = new Map<string, { accountId: string; platform: string; count: number }>()
    for (const p of publications) {
      if (!SYNC_REQUIRED_PLATFORMS.has(p.platform) || !p.account_id) continue
      const key = `${p.platform}:${p.account_id}`
      const existing = map.get(key)
      if (existing) {
        existing.count += 1
      } else {
        map.set(key, { accountId: p.account_id, platform: p.platform, count: 1 })
      }
    }
    return map
  }, [publications])

  useEffect(() => {
    if (!open || hasStarted) return

    setAccountGroups([])

    if (requiredAccountKeys.size === 0) return

    setLoadingAccounts(true)

    const platforms = Array.from(new Set(Array.from(requiredAccountKeys.values()).map(v => v.platform)))

    const load = async () => {
      const fetched: Record<string, any[]> = {}
      for (const platform of platforms) {
        try {
          const res = await fetch(`/api/accounts?platform=${platform}`)
          fetched[platform] = await res.json()
        } catch (e) {
          console.error(`Error cargando cuentas de ${platform}:`, e)
          fetched[platform] = []
        }
      }

      const groups: AccountGroup[] = Array.from(requiredAccountKeys.entries()).map(([key, info]) => {
        const accData = (fetched[info.platform] || []).find((a: any) => a.id === info.accountId)
        return {
          key,
          accountId: info.accountId,
          platform: info.platform,
          account_name: accData?.account_name,
          external_id: accData?.external_id,
          vestiaire_id: accData?.vestiaire_id ?? null,
          publicationCount: info.count,
          isSynced: false,
          isSyncing: false,
        }
      })

      setAccountGroups(groups)
      setLoadingAccounts(false)
    }

    load()
  }, [open, hasStarted, requiredAccountKeys])

  const runSync = (group: AccountGroup) => {
    if (group.platform === "vinted") return syncVintedAccount(group.external_id ?? group.accountId)
    if (group.platform === "wallapop") return syncWallapopAccount(group.external_id ?? group.accountId)
    if (group.platform === "vestiaire") return syncVestiaireAccount(group.external_id ?? group.accountId, group.vestiaire_id ?? null)
    if (group.platform === "depop") return syncDepopAccount(group.external_id ?? group.accountId)
    return Promise.resolve({ ok: false, message: "Plataforma no soportada" })
  }

  const syncOne = useCallback(async (group: AccountGroup) => {
    setAccountGroups(prev => prev.map(g => g.key === group.key ? { ...g, isSyncing: true } : g))

    const resSync = await runSync(group)

    if (resSync?.ok) {
      pushToast({ type: "info", message: resSync.message })
    } else {
      pushToast({
        type: "error",
        message: resSync?.message ?? "Error desconocido",
        description: `Intenta recargar la pestaña de ${PLATFORM_NAMES[group.platform] || group.platform} y ten iniciada la sesión.`
      })
    }

    let isOK = false
    try {
      const res = await fetch(`/api/accounts?platform=${group.platform}`)
      const data = await res.json()
      const updated = data.find((a: any) => a.id === group.accountId)
      isOK = updated?.sync_status === "OK"
      setAccountGroups(prev => prev.map(g => g.key === group.key
        ? { ...g, isSyncing: false, isSynced: isOK, account_name: updated?.account_name ?? g.account_name }
        : g
      ))
    } catch (e) {
      console.error(`Error recargando cuenta de ${group.platform}:`, e)
      setAccountGroups(prev => prev.map(g => g.key === group.key ? { ...g, isSyncing: false, isSynced: false } : g))
    }

    return isOK
  }, [pushToast])

  const syncAllPending = useCallback(async () => {
    const pending = accountGroups.filter(g => !g.isSynced && !g.isSyncing)
    if (pending.length === 0) return true
    setSyncingAll(true)
    let allOk = true
    for (const group of pending) {
      const ok = await syncOne(group)
      if (!ok) allOk = false
    }
    setSyncingAll(false)
    return allOk
  }, [accountGroups, syncOne])

  const handleConfirmSync = useCallback(async () => {
    if (syncingAll || loadingAccounts) return

    const pending = accountGroups.filter(g => !g.isSynced && !g.isSyncing)
    if (pending.length > 0) {
      await syncAllPending()
      const stillPending = accountGroups.filter(g => !g.isSynced)
      if (stillPending.length > 0) {
        pushToast({
          type: "error",
          message: "No se pudieron sincronizar todas las cuentas",
          description: "Reintenta o sincroniza manualmente cada cuenta."
        })
        return
      }
    }

    onConfirm()
  }, [accountGroups, syncAllPending, loadingAccounts, syncingAll, onConfirm, pushToast])

  const pendingCount = accountGroups.filter(g => !g.isSynced).length
  const anySyncing = accountGroups.some(g => g.isSyncing)

  // --- Fase de progreso (una vez existen jobs) ---
  const hasPendingOrActiveJob = jobs.some(
    (job) => job.status === 'pending' || job.status === 'processing' || job.status === 'retrying'
  )
  const allFailed = jobs.length > 0 && jobs.every((job) => job.status === 'failed')
  const blockClose = hasStarted ? ((isBusy || hasPendingOrActiveJob) && !allFailed) : (syncingAll || loadingAccounts)

  const failedCount = jobs.filter((j) => j.status === 'failed').length
  const completedCount = jobs.filter((j) => j.status === 'completed').length

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && blockClose) return
    if (!nextOpen) onClose()
  }

  const toggleExpanded = (jobId: string) => {
    setExpandedJobId((current) => (current === jobId ? null : jobId))
  }

  const getSummaryTitle = () => {
    if (blockClose) return title ?? 'Resubiendo publicaciones...'
    if (allFailed) return 'No se pudo resubir ninguna publicación'
    if (failedCount > 0) return 'Resubida completada con errores'
    return '¡Publicaciones resubidas!'
  }

  const getSummarySubtitle = () => {
    if (blockClose) return 'No cierres esta ventana mientras se resuben tus publicaciones.'
    if (allFailed) return 'Revisa los errores de cada publicación o cierra esta ventana.'
    if (failedCount > 0) return `${completedCount} resubida(s), ${failedCount} con error.`
    return 'Ya puedes cerrar esta ventana.'
  }

  // --- Render: fase de sincronización previa ---
  if (!hasStarted) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="!max-w-[560px] w-full p-0 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-gray-800">
                ¿Resubir {publications.length} publicaciones?
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="p-6 flex flex-col gap-4">
            {loadingAccounts && (
              <div className="flex items-center justify-center py-4 text-gray-500 text-sm gap-2">
                <Loader2 className="animate-spin h-4 w-4" />
                Comprobando cuentas implicadas…
              </div>
            )}

            {!loadingAccounts && accountGroups.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-600">
                    {pendingCount > 0
                      ? `${pendingCount} de ${accountGroups.length} cuenta(s) por sincronizar`
                      : `${accountGroups.length} cuenta(s) sincronizada(s)`}
                  </p>
                  {pendingCount > 0 && (
                    <button
                      onClick={syncAllPending}
                      disabled={anySyncing || syncingAll}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Sincronizar todas
                    </button>
                  )}
                </div>

                <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
                  {accountGroups.map((group) => (
                    <div
                      key={group.key}
                      className={`flex items-center justify-between px-4 py-3 ${group.isSynced ? 'bg-green-50/50' : 'bg-yellow-50/50'}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                          group.isSyncing ? 'text-blue-500' : group.isSynced ? 'text-green-500' : 'text-yellow-500'
                        }`}>
                          {group.isSyncing ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : group.isSynced ? (
                            <CheckCircle2 size={16} />
                          ) : (
                            <AlertTriangle size={16} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {group.account_name || "Cuenta sin nombre"}
                            <span className="text-gray-400 font-normal">
                              {" "}· {PLATFORM_NAMES[group.platform] || group.platform}
                            </span>
                          </p>
                          <p className="text-xs text-gray-500">
                            {group.publicationCount} publicación(es)
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => syncOne(group)}
                        disabled={group.isSyncing || syncingAll}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition disabled:opacity-50 disabled:cursor-not-allowed ${
                          group.isSynced
                            ? 'bg-white text-green-700 border border-green-300 hover:bg-green-100'
                            : 'bg-yellow-500 text-white hover:bg-yellow-600'
                        }`}
                      >
                        {group.isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        {group.isSynced ? 'Resincronizar' : 'Sincronizar'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {freePublicationsCount > 0 && (
              <p className="text-xs text-gray-400">
                {freePublicationsCount} publicación(es) más no requieren sincronización de cuenta.
              </p>
            )}
          </div>

          <div className="px-6 pb-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={syncingAll}
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmSync}
              disabled={loadingAccounts || syncingAll || anySyncing}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncingAll && <Loader2 className="animate-spin h-4 w-4" />}
              {syncingAll ? 'Sincronizando...' : `Resubir ${publications.length} publicación(es)`}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // --- Render: fase de progreso (igual que antes) ---
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="!max-w-[600px] w-full p-8 rounded-2xl max-h-[90vh] flex flex-col"
        onPointerDownOutside={(e) => { if (blockClose) e.preventDefault() }}
        onEscapeKeyDown={(e) => { if (blockClose) e.preventDefault() }}
        showCloseButton={!blockClose}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-2xl font-bold text-gray-800 mb-1">
            {getSummaryTitle()}
          </DialogTitle>
          <p className="text-gray-600 text-sm mb-6">
            {getSummarySubtitle()}
          </p>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {jobs.map((job) => {
            const errorMessage = (job as any).error ?? (job as any).message
            const isExpandable = job.status === 'failed' && !!errorMessage
            const isExpanded = expandedJobId === job.id

            return (
              <div key={job.id} className="border border-gray-200 rounded-xl overflow-hidden">
                <div
                  className={`flex items-center justify-between px-4 py-3 ${isExpandable ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                  onClick={() => isExpandable && toggleExpanded(job.id)}
                >
                  <span className="text-gray-800 font-medium">{job.entityLabel}</span>
                  <div className="flex items-center gap-2">
                    <JobStatusBadge status={job.status} />
                    {isExpandable && (
                      isExpanded
                        ? <ChevronUp size={18} className="text-gray-400" />
                        : <ChevronDown size={18} className="text-gray-400" />
                    )}
                  </div>
                </div>

                {isExpandable && isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                    <p className="text-sm text-gray-600 mb-3">
                      Motivo del error:{' '}
                      <span className="font-medium text-gray-800">{errorMessage}</span>
                    </p>

                    {onRetryJob && (
                      <button
                        onClick={() => {
                          onRetryJob(job)
                          setExpandedJobId(null)
                        }}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
                      >
                        <RefreshCw size={14} />
                        Reintentar
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {!blockClose && (
          <button
            onClick={onClose}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 mt-6 self-start shrink-0"
          >
            Cerrar
          </button>
        )}
      </DialogContent>
    </Dialog>
  )
}

function JobStatusBadge({ status }: { status: JobStatus }) {
  switch (status) {
    case 'completed':
      return <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium"><CheckCircle2 size={18} /> Resubido</span>
    case 'failed':
      return <span className="flex items-center gap-1.5 text-red-600 text-sm font-medium"><XCircle size={18} /> Error</span>
    case 'processing':
      return <span className="flex items-center gap-1.5 text-blue-600 text-sm font-medium"><Loader2 size={18} className="animate-spin" /> Resubiendo...</span>
    case 'retrying':
      return <span className="flex items-center gap-1.5 text-amber-600 text-sm font-medium"><Loader2 size={18} className="animate-spin" /> Reintentando...</span>
    default:
      return <span className="text-gray-400 text-sm font-medium">En cola</span>
  }
}

export default ReuploadPublicationProgressModal