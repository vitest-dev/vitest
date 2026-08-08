import type { VitestBrowserClient } from '@vitest/browser/client'
import type { ParsedStack } from 'vitest/internal/browser'
import type { SnapshotEnvironment } from 'vitest/runtime'
import { DecodedMap, getOriginalPosition } from 'vitest/internal/browser'

export class VitestBrowserSnapshotEnvironment implements SnapshotEnvironment {
  private sourceMaps = new Map<string, any>()
  private traceMaps = new Map<string, DecodedMap>()

  public addSourceMap(filepath: string, map: any): void {
    this.sourceMaps.set(filepath, map)
  }

  getVersion(): string {
    return '1'
  }

  getHeader(): string {
    return `// Vitest Snapshot v${this.getVersion()}, https://vitest.dev/guide/snapshot.html`
  }

  readSnapshotFile(filepath: string): Promise<string | null> {
    return rpc().readSnapshotFile(filepath)
  }

  // evaluate the snapshot file on the server: `new Function` is blocked in the
  // browser under a no-unsafe-eval CSP, so the tester never evaluates it here
  readSnapshotFileData(filepath: string): Promise<Record<string, string> | null> {
    return rpc().readSnapshotFileData(filepath)
  }

  saveSnapshotFile(filepath: string, snapshot: string): Promise<void> {
    return rpc().saveSnapshotFile(filepath, snapshot)
  }

  resolvePath(filepath: string): Promise<string> {
    return rpc().resolveSnapshotPath(filepath)
  }

  resolveRawPath(testPath: string, rawPath: string): Promise<string> {
    return rpc().resolveSnapshotRawPath(testPath, rawPath)
  }

  removeSnapshotFile(filepath: string): Promise<void> {
    return rpc().removeSnapshotFile(filepath)
  }

  processStackTrace(stack: ParsedStack): ParsedStack {
    const map = this.sourceMaps.get(stack.file)
    if (!map) {
      return stack
    }
    let traceMap = this.traceMaps.get(stack.file)
    if (!traceMap) {
      traceMap = new DecodedMap(map, stack.file)
      this.traceMaps.set(stack.file, traceMap)
    }
    const position = getOriginalPosition(traceMap, stack)
    if (position) {
      return { ...stack, line: position.line, column: position.column }
    }
    return stack
  }
}

function rpc(): VitestBrowserClient['rpc'] {
  // @ts-expect-error not typed global
  return globalThis.__vitest_worker__.rpc
}
