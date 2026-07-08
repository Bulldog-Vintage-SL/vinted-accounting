/*
  Instancia de la cola de subidas, aqui se editan los parametros de la cola de subidas.
*/

import { Queue } from './Queue'

export const appQueue = new Queue({
  concurrency:      1,
  delayBetweenJobs: 2500
})

export type { Job, JobAction, JobStatus, QueueEvent, ActionPayload } from './types'
export { Queue } from './Queue'