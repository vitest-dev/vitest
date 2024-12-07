import type { VitestBrowserClient } from '@vitest/browser/client'
import type { SnapshotEnvironment } from 'vitest/snapshot'
import { originalPositionFor, type ParsedStack, TraceMap } from 'vitest/utils'

export class VitestBrowserSnapshotEnvironment implements SnapshotEnvironment {
  private sourceMaps = new Map<string, any>()
  private traceMaps = new Map<string, TraceMap>()

  public addSourceMap(filepath: string, map: any) {
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
      traceMap = new TraceMap(map)
      this.traceMaps.set(stack.file, traceMap)
    }
    const { line, column } = originalPositionFor(traceMap, stack)
    if (line != null && column != null) {
      return { ...stack, line, column }
    }
    return stack
  }
}

function rpc(): VitestBrowserClient['rpc'] {
  // @ts-expect-error not typed global
  return globalThis.__vitest_worker__.rpc
}
