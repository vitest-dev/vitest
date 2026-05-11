import { appendFileSync } from 'node:fs'

export function traceDbg(message: string): void {
  const file = process.env.VITEST_TRACE_DBG_FILE
  if (!file) {
    return
  }
  try {
    appendFileSync(file, `${Date.now()} ${message}\n`)
  }
  catch {}
}
