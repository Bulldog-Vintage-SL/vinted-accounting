import type { Job, JobAction, JobStatus, QueueEvent, Executor } from './types'
import { executors } from './executors'

const ACTION_DELAYS: Record<string, number> = {
  upload: 5000,
  delete: 500,
  import: 500,
  deletePublication: 2500,
}

interface QueueOptions {
  concurrency?: number
  delayBetweenJobs?: number
}

type Handler<T> = (event: QueueEvent<T>) => void

export class Queue<T = unknown> {
  private pending: Job<JobAction, T>[] = []
  private completed: Job<JobAction, T>[] = []
  private activeCount: number = 0
  private handlers: Handler<T>[] = []
  private _paused: boolean = false

  private concurrency: number
  private defaultDelay: number

  private lastJobTimeByPlatform: Record<string, number> = {}

  public pendingAcks = new Map<string, {
    resolve: () => void
    reject: (err: Error) => void
  }>()

  constructor({
    concurrency = 2,
    delayBetweenJobs = 2000,
  }: QueueOptions = {}) {
    this.concurrency = concurrency
    this.defaultDelay = delayBetweenJobs
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

    for (let i = 0; i < this.concurrency; i++) {
      this.tick()
    }

    return jobs
  }

  pause() { this._paused = true }
  resume() { this._paused = false; for (let i = 0; i < this.concurrency; i++) this.tick() }

  retryJobs(jobs: Job<JobAction, T>[]) {
    const reset = jobs.map((j): Job<JobAction, T> => {
      const { error: _error, result: _result, ...rest } = j
      return {
        ...rest,
        status: 'pending',
      }
    })
    this.pending.unshift(...reset)
    for (let i = 0; i < this.concurrency; i++) this.tick()
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

  private async tick() {
    if (this._paused) return
    if (this.activeCount >= this.concurrency) return
    if (this.pending.length === 0) {
      if (this.activeCount === 0) this.emit({ type: 'queue:drained' })
      return
    }

    this.activeCount++

    let job: Job<JobAction, T> | undefined
    let jobIndex = -1

    for (let i = 0; i < this.pending.length; i++) {
      const candidate = this.pending[i]
      const platform = this.getPlatform(candidate)

      if (platform && this.lastJobTimeByPlatform[platform]) {
        const elapsed = Date.now() - this.lastJobTimeByPlatform[platform]
        const minDelay = ACTION_DELAYS[candidate.action] ?? this.defaultDelay
        if (elapsed < minDelay) continue
      }

      job = candidate
      jobIndex = i
      break
    }

    if (!job) {
      this.activeCount--
      const minDelay = Math.min(...Object.values(ACTION_DELAYS), this.defaultDelay)
      setTimeout(() => this.tick(), minDelay)
      return
    }

    this.pending.splice(jobIndex, 1)

    try {
      await this.process(job)
    } finally {
      const platform = this.getPlatform(job)
      if (platform) this.lastJobTimeByPlatform[platform] = Date.now()
      this.activeCount--
      this.tick()
    }
  }

  private async process(job: Job<JobAction, T>) {
    job.status = 'processing'
    this.emit({ type: 'job:start', job: { ...job } })

    const executor: Executor<T> = executors[job.action]

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
      this.completed.push(job)
      this.emit({ type: 'job:failed', job: { ...job } })
    }
  }
}