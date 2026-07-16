/*
  Tipos para el sistema de colas.
*/

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retrying'

export type JobAction = 'upload' | 'delete' | 'import' | 'deletePublication'

export interface ActionPayload {
  upload: {}
  delete: {}
  import: {}
  deletePublication: {}
}

export interface MissingField {
  key: string
  label: string
}

export interface Job<A extends JobAction = JobAction, T = unknown> {
  id:          string
  action:      A
  payload:     ActionPayload[A]
  entity:      T          
  entityLabel: string      
  status:      JobStatus
  error?:      string
  result?:     unknown    
  createdAt:   number
  finishedAt?: number
  missingFields?: MissingField[]
}

export type QueueEvent<T = unknown> =
  | { type: 'job:start';   job: Job<JobAction, T> }
  | { type: 'job:success'; job: Job<JobAction, T> }
  | { type: 'job:retry';   job: Job<JobAction, T> }
  | { type: 'job:failed';  job: Job<JobAction, T> }
  | { type: 'queue:drained' }
  | { type: 'queue:updated' }

export type Executor<T = unknown> = (
  job:         Job<JobAction, T>,
  pendingAcks: Map<string, { resolve: () => void; reject: (err: Error) => void }>
) => Promise<unknown>