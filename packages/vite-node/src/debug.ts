import { existsSync, promises as fs } from 'fs'
import { join } from 'pathe'
import type { TransformResult } from 'vite'
import type { DebuggerOptions } from './types'

function hashCode(s: string) {
  return s.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0)
}

export class Debugger {
  dumpDir: string | undefined

  constructor(public options: DebuggerOptions) {
    this.dumpDir = options.dumpModules === true ? '.vite-node/dump' : (options.dumpModules || undefined)
  }

  async clearDump() {
    if (!this.dumpDir || this.options.loadDumppedModules)
      return
    if (existsSync(this.dumpDir))
      await fs.rm(this.dumpDir, { recursive: true, force: true })
    await fs.mkdir(this.dumpDir, { recursive: true })
  }

  encodeId(id: string) {
    return `${id.replace(/[^\w@_-]/g, '_').replace(/_+/g, '_')}-${hashCode(id)}.js`
  }

  async dumpFile(id: string, result: TransformResult | null) {
    if (!result || !this.dumpDir)
      return
    const name = this.encodeId(id)
    return fs.writeFile(join(this.dumpDir, name), `// ${id.replace(/\0/g, '\\0')}\n${result.code}`, 'utf-8')
  }

  async loadDump(id: string): Promise<TransformResult | null> {
    if (!this.dumpDir)
      return null
    const name = this.encodeId(id)
    const path = join(this.dumpDir, name)
    if (!existsSync(path))
      return null
    const code = await fs.readFile(path, 'utf-8')
    return {
      code,
      map: undefined!,
    }
  }
}
