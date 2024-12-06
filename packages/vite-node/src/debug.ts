import type { TransformResult } from 'vite'
import type { DebuggerOptions } from './types'
/* eslint-disable no-console */
import { existsSync, promises as fs } from 'node:fs'
import { join, resolve } from 'pathe'
import c from 'tinyrainbow'

// Reason for 5381:
// https://stackoverflow.com/questions/10696223/reason-for-the-number-5381-in-the-djb-hash-function
const ALTERNATIVE_HASH_CODE_STARTING_VALUE = 5381

// This is djb hash function
function hashCode(s: string, startingValue = 0) {
  return s.split('').reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0)
    return a & a
  }, startingValue)
}

export class Debugger {
  dumpDir: string | undefined
  initPromise: Promise<void> | undefined
  externalizeMap = new Map<string, string>()

  constructor(root: string, public options: DebuggerOptions) {
    if (options.dumpModules) {
      this.dumpDir = resolve(
        root,
        options.dumpModules === true ? '.vite-node/dump' : options.dumpModules,
      )
    }
    if (this.dumpDir) {
      if (options.loadDumppedModules) {
        console.info(
          c.gray(`[vite-node] [debug] load modules from ${this.dumpDir}`),
        )
      }
      else {
        console.info(
          c.gray(`[vite-node] [debug] dump modules to ${this.dumpDir}`),
        )
      }
    }
    this.initPromise = this.clearDump()
  }

  async clearDump() {
    if (!this.dumpDir) {
      return
    }
    if (!this.options.loadDumppedModules && existsSync(this.dumpDir)) {
      await fs.rm(this.dumpDir, { recursive: true, force: true })
    }
    await fs.mkdir(this.dumpDir, { recursive: true })
  }

  encodeId(id: string) {
    return `${hashCode(id, 0)}-${hashCode(id, ALTERNATIVE_HASH_CODE_STARTING_VALUE)}.js`
  }

  async recordExternalize(id: string, path: string) {
    if (!this.dumpDir) {
      return
    }
    this.externalizeMap.set(id, path)
    await this.writeInfo()
  }

  async dumpFile(id: string, result: TransformResult | null) {
    if (!result || !this.dumpDir) {
      return
    }
    await this.initPromise
    const name = this.encodeId(id)
    return await fs.writeFile(
      join(this.dumpDir, name),
      `// ${id.replace(/\0/g, '\\0')}\n${result.code}`,
      'utf-8',
    )
  }

  async loadDump(id: string): Promise<TransformResult | null> {
    if (!this.dumpDir) {
      return null
    }
    await this.initPromise
    const name = this.encodeId(id)
    const path = join(this.dumpDir, name)
    if (!existsSync(path)) {
      return null
    }
    const code = await fs.readFile(path, 'utf-8')
    return {
      code: code.replace(/^\/\/.*\n/, ''),
      map: undefined!,
    }
  }

  async writeInfo() {
    if (!this.dumpDir) {
      return
    }
    const info = JSON.stringify(
      {
        time: new Date().toLocaleString(),
        externalize: Object.fromEntries(this.externalizeMap.entries()),
      },
      null,
      2,
    )
    return fs.writeFile(join(this.dumpDir, 'info.json'), info, 'utf-8')
  }
}
