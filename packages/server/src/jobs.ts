import { shortId } from '@perfagent/core'

export interface Job<T = unknown> {
  id: string
  kind: string
  status: 'queued' | 'running' | 'done' | 'failed'
  startedAt: string
  finishedAt?: string
  progress: { phase: string; message: string; fraction: number }
  result?: T
  error?: string
}

/**
 * Runs one job at a time (a real browser per scan is heavy) and keeps the
 * last 50 for status polling. Work is async I/O, so the server stays responsive.
 */
export class JobQueue {
  private readonly jobs = new Map<string, Job>()
  private chain: Promise<unknown> = Promise.resolve()

  enqueue<T>(
    kind: string,
    work: (report: (progress: Job['progress']) => void) => Promise<T>,
    onDone?: (job: Job<T>) => void,
  ): Job<T> {
    const job: Job<T> = {
      id: shortId('job'),
      kind,
      status: 'queued',
      startedAt: new Date().toISOString(),
      progress: { phase: 'queued', message: 'Waiting for a free slot', fraction: 0 },
    }
    this.jobs.set(job.id, job)
    this.trim()
    this.chain = this.chain.then(async () => {
      job.status = 'running'
      try {
        job.result = await work((progress) => {
          job.progress = progress
        })
        job.status = 'done'
      } catch (error) {
        job.status = 'failed'
        job.error = error instanceof Error ? error.message : String(error)
      }
      job.finishedAt = new Date().toISOString()
      onDone?.(job)
    })
    return job
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id)
  }

  list(): Job[] {
    return [...this.jobs.values()]
  }

  private trim(): void {
    const finished = [...this.jobs.values()].filter(
      (j) => j.status === 'done' || j.status === 'failed',
    )
    while (finished.length > 50) {
      const oldest = finished.shift()
      if (oldest) this.jobs.delete(oldest.id)
    }
  }
}
