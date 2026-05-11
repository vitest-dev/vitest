import { appendFileSync } from 'node:fs'

export function wdioDbg(message: string): void {
  const file = process.env.VITEST_WDIO_DBG_FILE
  if (!file) {
    return
  }
  try {
    appendFileSync(file, `${Date.now()} ${message}\n`)
  }
  catch {}
}
