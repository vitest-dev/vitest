import type { Writable } from 'node:stream'
import type { Vitest } from '../../core'
import { stripVTControlCharacters } from 'node:util'

const DEFAULT_RENDER_INTERVAL_MS = 1_000

const ESC = '\x1B['
const CLEAR_LINE = `${ESC}K`
const MOVE_CURSOR_ONE_ROW_UP = `${ESC}1A`
const SYNC_START = `${ESC}?2026h`
const SYNC_END = `${ESC}?2026l`

interface Options {
  logger: Vitest['logger']
  interval?: number
  getWindow: () => string[]
}

type StreamType = 'output' | 'error'

/**
 * Renders content of `getWindow` at the bottom of the terminal and
 * forwards all other intercepted `stdout` and `stderr` logs above it.
 */
export class WindowRenderer {
  private options: Required<Options>
  private streams!: Record<StreamType, Vitest['logger']['outputStream' | 'errorStream']['write']>
  private buffer: { type: StreamType; message: string }[] = []
  private renderInterval: NodeJS.Timeout | undefined = undefined
  private renderScheduled = false

  private windowHeight = 0
  private finished = false
  private cleanups: (() => void)[] = []

  constructor(options: Options) {
    this.options = {
      interval: DEFAULT_RENDER_INTERVAL_MS,
      ...options,
    }

    this.streams = {
      output: options.logger.outputStream.write.bind(options.logger.outputStream),
      error: options.logger.errorStream.write.bind(options.logger.errorStream),
    }

    this.cleanups.push(
      this.interceptStream(process.stdout, 'output'),
      this.interceptStream(process.stderr, 'error'),
    )

    // Write buffered content on unexpected exits, e.g. direct `process.exit()` calls
    this.options.logger.onTerminalCleanup(() => {
      this.flushBuffer()
      this.stop()
    })

    this.start()
  }

  start() {
    this.finished = false
    this.renderInterval = setInterval(() => this.schedule(), this.options.interval).unref()
  }

  stop() {
    this.cleanups.splice(0).map(fn => fn())
    clearInterval(this.renderInterval)
  }

  /**
   * Write all buffered output and stop buffering.
   * All intercepted writes are forwarded to actual write after this.
   */
  finish() {
    this.finished = true
    this.flushBuffer()
    clearInterval(this.renderInterval)
  }

  /**
   * Queue new render update
   */
  schedule() {
    if (!this.renderScheduled) {
      this.renderScheduled = true
      this.flushBuffer()

      setTimeout(() => {
        this.renderScheduled = false
      }, 100).unref()
    }
  }

  private flushBuffer() {
    if (this.buffer.length === 0) {
      return this.render()
    }

    let current

    // Concatenate same types into a single render
    for (const next of this.buffer.splice(0)) {
      if (!current) {
        current = next
        continue
      }

      if (current.type !== next.type) {
        this.render(current.message, current.type)
        current = next
        continue
      }

      current.message += next.message
    }

    if (current) {
      this.render(current?.message, current?.type)
    }
  }

  private render(message?: string, type: StreamType = 'output') {
    if (this.finished) {
      this.clearWindow()
      return this.write(message || '', type)
    }

    const windowContent = this.options.getWindow()
    const rowCount = getRenderedRowCount(windowContent, this.options.logger.getColumns())
    let padding = this.windowHeight - rowCount

    if (padding > 0 && message) {
      padding -= getRenderedRowCount([message], this.options.logger.getColumns())
    }

    this.write(SYNC_START)
    this.clearWindow()

    if (message) {
      this.write(message, type)
    }

    if (padding > 0) {
      this.write('\n'.repeat(padding))
    }

    this.write(windowContent.join('\n'))
    this.write(SYNC_END)

    this.windowHeight = rowCount + Math.max(0, padding)
  }

  private clearWindow() {
    if (this.windowHeight === 0) {
      return
    }

    this.write(CLEAR_LINE)

    for (let i = 1; i < this.windowHeight; i++) {
      this.write(`${MOVE_CURSOR_ONE_ROW_UP}${CLEAR_LINE}`)
    }

    this.windowHeight = 0
  }

  private interceptStream(stream: NodeJS.WriteStream, type: StreamType) {
    const original = stream.write

    // @ts-expect-error -- not sure how 2 overloads should be typed
    stream.write = (chunk, _, callback) => {
      if (chunk) {
        if (this.finished) {
          this.write(chunk.toString(), type)
        }
        else {
          this.buffer.push({ type, message: chunk.toString() })
        }
      }
      callback?.()
    }

    return function restore() {
      stream.write = original
    }
  }

  private write(message: string, type: 'output' | 'error' = 'output') {
    (this.streams[type] as Writable['write'])(message)
  }
}

/** Calculate the actual row count needed to render `rows` into `stream` */
function getRenderedRowCount(rows: string[], columns: number) {
  let count = 0

  for (const row of rows) {
    const text = stripVTControlCharacters(row)
    count += Math.max(1, Math.ceil(text.length / columns))
  }

  return count
}
