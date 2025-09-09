import type { ContextRPC } from '../types/worker'
import * as worker from './worker'
import forks from './workers/forks'
import threads from './workers/threads'

export async function run(ctx: ContextRPC): Promise<void> {
  await worker.execute('run', ctx, ctx.pool === 'forks' ? forks : threads)
}

export async function collect(ctx: ContextRPC): Promise<void> {
  await worker.execute('collect', ctx, ctx.pool === 'forks' ? forks : threads)
}

export async function teardown(): Promise<void> {
  await worker.teardown()
}
