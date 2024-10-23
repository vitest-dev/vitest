import type { TraceMap } from '@jridgewell/trace-mapping'

// Maps a file path to a source map for that file
export const sourceMapCache: Record<
  string,
  { url: string | null; map: TraceMap | null }
> = {}
