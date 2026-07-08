/*
  Componente de estado de la cola de acciones masivas sobre productos. TODO: Mostrar bien el progreso.
*/

interface Stats {
  total: number; pending: number; processing: number
  completed: number; failed: number; progress: number
}

interface Props {
  stats: Stats
  isPaused: boolean
  onPause: () => void
  onResume: () => void
  onRetryFailed: () => void
}

export function QueueStatusBar({ stats, isPaused, onPause, onResume, onRetryFailed }: Props) {
  return (
    <div className="mb-4 bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col gap-2">

      {/* Barra de progreso */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${stats.progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-600">

        {/* Contadores */}
        <div className="flex gap-3">
          <span>Total: <b>{stats.total}</b></span>
          {stats.processing > 0 && <span className="text-blue-600">Subiendo: <b>{stats.processing}</b></span>}
          {stats.pending    > 0 && <span>En cola: <b>{stats.pending}</b></span>}
          {stats.completed  > 0 && <span className="text-green-600">Listos: <b>{stats.completed}</b></span>}
          {stats.failed     > 0 && <span className="text-red-600">Fallidos: <b>{stats.failed}</b></span>}
        </div>

        {/* Controles */}
        <div className="flex gap-2">
          {stats.failed > 0 && (
            <button
              onClick={onRetryFailed}
              className="text-orange-600 hover:underline font-medium"
            >
              Reintentar fallidos
            </button>
          )}
          {isPaused ? (
            <button onClick={onResume} className="text-green-600 hover:underline font-medium">
              ▶ Reanudar
            </button>
          ) : (
            <button onClick={onPause} className="text-gray-500 hover:underline">
              ⏸ Pausar
            </button>
          )}
        </div>

      </div>

    </div>
  )
}