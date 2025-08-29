import type { ContextRPC } from '../types/worker'
import * as worker from './worker'
import vmForks from './workers/vmForks'
import vmThreads from './workers/vmThreads'

export async function run(ctx: ContextRPC): Promise<void> {
  await worker.execute('run', ctx, ctx.pool === 'vmForks' ? vmForks : vmThreads)
}

export async function collect(ctx: ContextRPC): Promise<void> {
  await worker.execute('collect', ctx, ctx.pool === 'vmForks' ? vmForks : vmThreads)
}

export async function teardown(): Promise<void> {
  await worker.teardown()
}
