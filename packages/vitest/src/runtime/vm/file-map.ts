import { readFileSync } from 'node:fs'

export class FileMap {
  private fsCache = new Map<string, string>()
  private fsBufferCache = new Map<string, Buffer>()

  public readFile(path: string) {
    const cached = this.fsCache.get(path)
    if (cached)
      return cached
    const source = readFileSync(path, 'utf-8')
    this.fsCache.set(path, source)
    return source
  }

  public readBuffer(path: string) {
    const cached = this.fsBufferCache.get(path)
    if (cached)
      return cached
    const buffer = readFileSync(path)
    this.fsBufferCache.set(path, buffer)
    return buffer
  }
}
