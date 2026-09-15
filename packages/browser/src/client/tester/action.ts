import type { SerializedLocator } from './locators'
import { getBrowserState, getWorkerState } from '../utils'

export interface ActionOptions {
  timeout?: number
}

// an array gets the options appended; a factory receives them and builds the full argument list
type ActionArguments = unknown[] | ((options: ActionOptions | undefined) => Promise<unknown[]>)

/** explicit option, then the provider default, then the remaining task time */
export function resolveActionTimeout(options?: ActionOptions): number | undefined {
  if (options?.timeout != null) {
    return options.timeout
  }
  if (getWorkerState().config.browser.providerOptions.actionTimeout != null) {
    return undefined
  }
  return getBrowserState().runner._deadline?.derive()
}

/**
 * @deprecated the timeout is derived by the action itself; pass the options through unchanged
 */
export function processTimeoutOptions<T extends { timeout?: number }>(options?: T): T | undefined {
  const timeout = resolveActionTimeout(options)
  if (timeout == null) {
    return options
  }
  return { ...options, timeout } as T
}

/**
 * A browser command that the test awaits. The action derives its own timeout
 * from the running task, so it fails with a descriptive error before the task does.
 */
class Action<T = void> implements Promise<T> {
  public readonly [Symbol.toStringTag] = 'Action'
  readonly #command: string
  readonly #args: ActionArguments
  readonly #options: ActionOptions | undefined
  readonly #errorSource: Error
  #promise: Promise<T> | undefined
  #awaited = false

  constructor(
    command: string,
    args: ActionArguments,
    options: ActionOptions | undefined,
    errorSource?: Error,
  ) {
    this.#command = command
    this.#args = args
    this.#options = options
    this.#errorSource = errorSource ?? new Error('STACK_TRACE_ERROR')
    const test = getWorkerState().current
    if (errorSource || !test || test.type !== 'test') {
      this.#promise = this.#run()
      return
    }
    test.onFinished ??= []
    test.onFinished.push(() => {
      if (!this.#awaited) {
        const error = new Error(
          `The call was not awaited. This method is asynchronous and must be awaited; otherwise, the call will not start to avoid unhandled rejections.`,
        )
        error.stack = this.#errorSource.stack?.replace(this.#errorSource.message, error.message)
        throw error
      }
    })
  }

  async #run(): Promise<T> {
    const timeout = resolveActionTimeout(this.#options)
    const options = timeout == null ? this.#options : { ...this.#options, timeout }
    const args = typeof this.#args === 'function'
      ? await this.#args(options)
      : [...this.#args, options]
    const promise = getBrowserState().commands.triggerCommand<T>(
      this.#command,
      args,
      this.#errorSource,
    )
    const deadline = getBrowserState().runner._deadline
    return deadline && timeout != null
      ? deadline.track(this.#command.slice('__vitest_'.length), promise, timeout, this.#errorSource)
      : promise
  }

  // the command starts only when awaited, so an unawaited action cannot reject unhandled
  #start(): Promise<T> {
    this.#awaited = true
    return this.#promise ??= this.#run()
  }

  then<R1 = T, R2 = never>(
    onFulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: any) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return this.#start().then(onFulfilled, onRejected)
  }

  catch<R = never>(onRejected?: ((reason: any) => R | PromiseLike<R>) | null): Promise<T | R> {
    return this.#start().catch(onRejected)
  }

  finally(onFinally?: (() => void) | null): Promise<T> {
    return this.#start().finally(onFinally)
  }
}

export class LocatorAction<T = void> extends Action<T> {
  constructor(
    target: SerializedLocator,
    command: string,
    args: unknown[],
    options?: ActionOptions,
    errorSource?: Error,
  ) {
    super(command, [target, ...args], options, errorSource)
  }
}

export class UploadAction extends Action {
  constructor(
    target: SerializedLocator,
    files: string | string[] | File | File[],
    options?: ActionOptions,
    errorSource?: Error,
  ) {
    super('__vitest_upload', async options => [target, await readFiles(files), options], options, errorSource)
  }
}

export class ScreenshotAction<T> extends Action<T> {
  constructor(
    name: string,
    options: ActionOptions,
    serialize: () => Promise<Record<string, unknown>>,
  ) {
    super('__vitest_screenshot', async options => [name, { ...options, ...await serialize() }], options)
  }
}

function readFiles(files: string | string[] | File | File[]): Promise<(string | { name: string; mimeType: string; base64: string })[]> {
  return Promise.all((Array.isArray(files) ? files : [files]).map(async (file) => {
    if (typeof file === 'string') {
      return file
    }
    const bas64String = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`))
      reader.readAsDataURL(file)
    })

    return {
      name: file.name,
      mimeType: file.type,
      // strip prefix `data:[<media-type>][;base64],`
      base64: bas64String.slice(bas64String.indexOf(',') + 1),
    }
  }))
}
