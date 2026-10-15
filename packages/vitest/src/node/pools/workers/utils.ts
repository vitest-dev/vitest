import type { Readable } from 'node:stream'

// After a worker dies, its remaining stdio is drained into the parent-side
// readables asynchronously. Waiting for `end`/`close` before unpiping ensures
// the tail of the output still reaches the shared logger streams.
export function streamFlushed(stream: Readable): Promise<unknown> {
  if (stream.readableEnded || stream.destroyed) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    stream.once('end', resolve)
    stream.once('close', resolve)
  })
}
