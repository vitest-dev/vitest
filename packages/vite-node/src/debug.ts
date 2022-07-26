/* eslint-disable no-console */
import { existsSync, promises as fs } from 'fs'
import { join, resolve } from 'pathe'
import type { TransformResult } from 'vite'
import { gray } from 'kolorist'
import type { DebuggerOptions } from './types'

function hashCode(s: string) {
  return s.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0)
}

export class Debugger {
  dumpDir: string | undefined
  initPromise: Promise<void> | undefined

  constructor(root: string, public options: DebuggerOptions) {
    if (options.dumpModules)
      this.dumpDir = resolve(root, options.dumpModules === true ? '.vite-node/dump' : options.dumpModules)
    if (this.dumpDir) {
      if (options.loadDumppedModules)
        console.info(gray(`[vite-node] [debug] load modules from ${this.dumpDir}`))
      else
        console.info(gray(`[vite-node] [debug] dump modules to ${this.dumpDir}`))
    }
    this.initPromise = this.clearDump()
  }

  async clearDump() {
    if (!this.dumpDir)
      return
    if (!this.options.loadDumppedModules && existsSync(this.dumpDir))
      await fs.rm(this.dumpDir, { recursive: true, force: true })
    await fs.mkdir(this.dumpDir, { recursive: true })
  }

  encodeId(id: string) {
    return `${id.replace(/[^\w@_-]/g, '_').replace(/_+/g, '_')}-${hashCode(id)}.js`
  }

  async dumpFile(id: string, result: TransformResult | null) {
    if (!result || !this.dumpDir)
      return
    await this.initPromise
    const name = this.encodeId(id)
    return await fs.writeFile(join(this.dumpDir, name), `// ${id.replace(/\0/g, '\\0')}\n${result.code}`, 'utf-8')
  }

  async loadDump(id: string): Promise<TransformResult | null> {
    if (!this.dumpDir)
      return null
    await this.initPromise
    const name = this.encodeId(id)
    const path = join(this.dumpDir, name)
    if (!existsSync(path))
      return null
    const code = await fs.readFile(path, 'utf-8')
    return {
      code: code.replace(/^\/\/.*?\n/, ''),
      map: undefined!,
    }
  }
}
