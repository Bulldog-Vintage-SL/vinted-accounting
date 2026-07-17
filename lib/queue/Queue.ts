import type { Job, JobAction, JobStatus, QueueEvent, Executor } from './types'
import { executors } from './executors'
import { MissingFieldsError } from '@/lib/external-integrations/validators'


const DEFAULT_ACTION_DELAYS: Partial<Record<JobAction, number>> = {
  upload: 5000,
  delete: 0,
  import: 500,
  deletePublication: 2500,
}

type ActionDelayMap = Partial<Record<JobAction, number>>

interface QueueOptions {
  concurrency?: number
  delayBetweenJobs?: number
  actionDelays?: ActionDelayMap
  platformDelays?: Record<string, ActionDelayMap>
  noRateLimitActions?: JobAction[]
}

type Handler<T> = (event: QueueEvent<T>) => void

export class Queue<T = unknown> {
  private pending: Job<JobAction, T>[] = []
  private completed: Job<JobAction, T>[] = []
  private handlers: Handler<T>[] = []
  private _paused: boolean = false

  private activeCount: number = 0

  private activePlatforms: Set<string> = new Set()

  private activeCountNoPlatform: number = 0
  private concurrency: number

  private defaultDelay: number
  private actionDelays: ActionDelayMap
  private platformDelays: Record<string, ActionDelayMap>
  private noRateLimitActions: Set<JobAction>

  private lastJobTimeByPlatform: Record<string, number> = {}
  private retryTimer: ReturnType<typeof setTimeout> | null = null

  public pendingAcks = new Map<string, {
    resolve: () => void
    reject: (err: Error) => void
  }>()

  constructor({
    concurrency = 3,
    delayBetweenJobs = 2000,
    actionDelays = {},
    platformDelays = {},
    noRateLimitActions = ['delete'],
  }: QueueOptions = {}) {
    this.concurrency = concurrency
    this.defaultDelay = delayBetweenJobs
    this.actionDelays = { ...DEFAULT_ACTION_DELAYS, ...actionDelays }
    this.platformDelays = { ...platformDelays }
    this.noRateLimitActions = new Set(noRateLimitActions)
  }

  on(handler: Handler<T>) {
    this.handlers.push(handler)
    return () => { this.handlers = this.handlers.filter(h => h !== handler) }
  }

  private emit(event: QueueEvent<T>) {
    this.handlers.forEach(h => h(event))
  }

  get isPaused() { return this._paused }

  getAllJobs(): Job<JobAction, T>[] {
    return [...this.pending, ...this.completed]
  }

  setActionDelay(action: JobAction, ms: number | undefined) {
    if (ms === undefined) delete this.actionDelays[action]
    else this.actionDelays[action] = ms
  }

  setPlatformActionDelay(platform: string, action: JobAction, ms: number | undefined) {
    const current = this.platformDelays[platform] ?? {}
    if (ms === undefined) {
      delete current[action]
    } else {
      current[action] = ms
    }
    this.platformDelays[platform] = current
  }

  setNoRateLimit(action: JobAction, exempt: boolean = true) {
    if (exempt) this.noRateLimitActions.add(action)
    else this.noRateLimitActions.delete(action)
  }

  setConcurrency(n: number) {
    this.concurrency = n
    this.tick()
  }

  private getDelay(platform: string, action: JobAction): number {
    if (this.noRateLimitActions.has(action)) return 0
    const override = this.platformDelays[platform]?.[action]
    if (override !== undefined) return override
    return this.actionDelays[action] ?? this.defaultDelay
  }


  enqueue<A extends JobAction>(
    action: A,
    entities: T[],
    payload: import('./types').ActionPayload[A],
    getLabel: (entity: T) => string,
  ): Job<A, T>[] {
    const jobs = entities.map(entity => ({
      id: crypto.randomUUID(),
      action,
      payload,
      entity,
      entityLabel: getLabel(entity),
      status: 'pending' as JobStatus,
      createdAt: Date.now(),
    } satisfies Job<A, T>))

    this.pending.push(...jobs)
    this.tick()

    return jobs
  }

  pause() { this._paused = true }
  resume() { this._paused = false; this.tick() }

  retryJobs(jobs: Job<JobAction, T>[]) {
    const reset: Job<JobAction, T>[] = jobs.map(j => ({
      ...j,
      status: 'pending' as JobStatus,
      error: undefined as string | undefined,
      result: undefined as Job<JobAction, T>['result'],
      missingFields: undefined,
    }))
    this.pending.unshift(...reset)
    this.tick()
  }

  retryJobWithPatch(jobId: string, updater: (entity: T) => T) {
    const idx = this.completed.findIndex(j => j.id === jobId)
    if (idx === -1) return

    const [job] = this.completed.splice(idx, 1)

    job.entity = updater(job.entity)
    job.status = 'pending'
    job.error = undefined
    job.missingFields = undefined
    job.result = undefined
    job.finishedAt = undefined

    this.pending.unshift(job)
    this.emit({ type: 'queue:updated' } as any)
    this.tick()
  }
  
  ackJob(listingId: string) {
    const ack = this.pendingAcks.get(listingId)
    if (ack) {
      ack.resolve()
      this.pendingAcks.delete(listingId)
    }
  }

  nackJob(listingId: string, error: string) {
    const ack = this.pendingAcks.get(listingId)
    if (ack) {
      ack.reject(new Error(error))
      this.pendingAcks.delete(listingId)
    }
  }

  clear() {
    this.completed = []
    this.emit({ type: 'queue:updated' } as any)
  }

  private getPlatform(job: Job<JobAction, T>): string | null {
    const entity = job.entity as any
    if (job.action === 'upload') return entity?.account?.platform || entity?.platform || null
    if (job.action === 'deletePublication' || job.action === 'import') return entity?.platform || null
    return null
  }

  private tick() {
    if (this._paused) return

    let i = 0
    while (i < this.pending.length) {
      const job = this.pending[i]
      const platform = this.getPlatform(job)

      if (platform) {
        if (this.activePlatforms.has(platform)) { i++; continue }

        const lastTime = this.lastJobTimeByPlatform[platform]
        if (lastTime) {
          const elapsed = Date.now() - lastTime
          const minDelay = this.getDelay(platform, job.action)
          if (elapsed < minDelay) { i++; continue }
        }
      } else {
        if (this.activeCountNoPlatform >= this.concurrency) { i++; continue }
      }

      this.pending.splice(i, 1)

      if (platform) {
        this.activePlatforms.add(platform)
      } else {
        this.activeCountNoPlatform++
      }
      this.activeCount++

      this.runJob(job, platform)
    }

    if (this.pending.length === 0) {
      if (this.activeCount === 0) this.emit({ type: 'queue:drained' })
      return
    }

    this.scheduleRetryForBlockedJobs()
  }


  private scheduleRetryForBlockedJobs() {
    let minWait: number | null = null

    for (const job of this.pending) {
      const platform = this.getPlatform(job)
      if (!platform) continue
      if (this.activePlatforms.has(platform)) continue

      const lastTime = this.lastJobTimeByPlatform[platform]
      if (!lastTime) continue

      const elapsed = Date.now() - lastTime
      const minDelay = this.getDelay(platform, job.action)
      const remaining = minDelay - elapsed

      if (remaining > 0 && (minWait === null || remaining < minWait)) {
        minWait = remaining
      }
    }

    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }

    if (minWait !== null) {
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null
        this.tick()
      }, minWait)
    }
  }

  private async runJob(job: Job<JobAction, T>, platform: string | null) {
    try {
      await this.process(job)
    } finally {
      if (platform) {
        this.lastJobTimeByPlatform[platform] = Date.now()
        this.activePlatforms.delete(platform)
      } else {
        this.activeCountNoPlatform--
      }
      this.activeCount--
      this.tick()
    }
  }

  private async process<A extends JobAction>(job: Job<A, T>) {
    job.status = 'processing'
    this.emit({ type: 'job:start', job: { ...job } })

    const executor = executors[job.action] as Executor<T>

    try {
      const result = await executor(job, this.pendingAcks)
      job.status = 'completed'
      job.result = result
      job.finishedAt = Date.now()
      this.completed.push(job)
      this.emit({ type: 'job:success', job: { ...job } })

    } catch (err) {
      job.status = 'failed'
      job.error = err instanceof Error ? err.message : 'Error desconocido'
      job.finishedAt = Date.now()

      if (err instanceof MissingFieldsError) {
        job.error = err.message
        job.missingFields = err.fields
      } else {
        job.error = err instanceof Error ? err.message : 'Error desconocido'
      }

      this.completed.push(job)
      this.emit({ type: 'job:failed', job: { ...job } })
    }
  }
}