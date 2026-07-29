import { vi } from 'vitest'
import { commands } from 'vitest/browser'

// use file system command to communicate with e2e
// to precisely control the timing of incremental trace update
export async function waitForGate(name: string) {
  if (!(import.meta as any).env.TEST_GATE_FILE) {
    await new Promise(r => setTimeout(r, 2000))
    return
  }
  const gatePath = `./node_modules/.vitest-e2e/${name}.txt`
  await vi.waitUntil(async () => {
    try {
      const content = await commands.readFile(gatePath)
      return content.includes('open')
    }
    catch {
      return false
    }
  }, { timeout: 10000 })
}
