import type {
  Context,
  ContextAPI,
  PropagationAPI,
  Span,
  SpanOptions,
  SpanStatusCode,
  TraceAPI,
  Tracer,
} from '@opentelemetry/api'

// important: this module should not import types, it should only expose them
// because it is used by browser, node and test types at the same time

export interface OTELCarrier {
  traceparent?: string
  tracestate?: string
}

interface TracesOptions {
  enabled: boolean
  watchMode?: boolean
  sdkPath?: string
  tracerName?: string
}

interface TracesSpanOptions extends SpanOptions {
  context?: Context
}

interface OTEL {
  tracer: Tracer
  trace: TraceAPI
  context: ContextAPI
  SpanStatusCode: typeof SpanStatusCode
  propagation: PropagationAPI
}

export class Traces {
  /**
   * otel stands for OpenTelemetry
   */
  #otel: OTEL | null = null
  #sdk: { shutdown: () => Promise<void>; forceFlush?: () => Promise<void> } | null = null
  #init: Promise<unknown> | null = null
  #noopSpan = createNoopSpan()
  #noopContext = createNoopContext()
  #initStartTime = performance.now()
  #initEndTime = 0
  #initRecorded = false

  constructor(options: TracesOptions) {
    if (options.enabled) {
      const apiInit = import('@opentelemetry/api').then((api) => {
        const otel = {
          tracer: api.trace.getTracer(options.tracerName || 'vitest'),
          context: api.context,
          propagation: api.propagation,
          trace: api.trace,
          SpanKind: api.SpanKind,
          SpanStatusCode: api.SpanStatusCode,
        }
        this.#otel = otel
      }).catch(() => {
        throw new Error(`"@opentelemetry/api" is not installed locally. Make sure you have setup OpenTelemetry instrumentation: https://vitest.dev/guide/open-telemetry`)
      })
      const sdkInit = (options.sdkPath ? import(/* @vite-ignore */ options.sdkPath!) : Promise.resolve()).catch((cause) => {
        throw new Error(`Failed to import custom OpenTelemetry SDK script (${options.sdkPath}): ${cause.message}`)
      })
      this.#init = Promise.all([sdkInit, apiInit]).then(([sdk]) => {
        if (sdk != null) {
          if (sdk.default != null && typeof sdk.default === 'object' && typeof sdk.default.shutdown === 'function') {
            this.#sdk = sdk.default
          }
          else if (options.watchMode !== true && process.env.VITEST_MODE !== 'watch') {
            console.warn(`OpenTelemetry instrumentation module (${options.sdkPath}) does not have a default export with a "shutdown" method. Vitest won't be able to ensure that all traces are processed in time. Try running Vitest in watch mode instead.`)
          }
        }
      }).finally(() => {
        this.#initEndTime = performance.now()
        this.#init = null
      })
    }
  }

  public isEnabled(): boolean {
    return !!this.#otel
  }

  /**
   * @internal
   */
  async waitInit(): Promise<this> {
    if (this.#init) {
      await this.#init
    }
    return this
  }

  /**
   * @internal
   */
  recordInitSpan(context: Context): void {
    if (this.#initRecorded) {
      return
    }
    this.#initRecorded = true
    this
      .startSpan('vitest.runtime.traces', { startTime: this.#initStartTime }, context)
      .end(this.#initEndTime)
  }

  /**
   * @internal
   */
  startContextSpan(name: string, currentContext?: Context): {
    span: Span
    context: Context
  } {
    if (!this.#otel) {
      return {
        span: this.#noopSpan,
        context: this.#noopContext,
      }
    }

    const activeContext = currentContext || this.#otel.context.active()
    const span = this.#otel.tracer.startSpan(
      name,
      {},
      activeContext,
    )
    const context = this.#otel.trace.setSpan(activeContext, span)
    return {
      span,
      context,
    }
  }

  /**
   * @internal
   */
  getContextFromCarrier(carrier: OTELCarrier | undefined): Context {
    if (!this.#otel) {
      return this.#noopContext
    }
    const activeContext = this.#otel.context.active()
    if (!carrier) {
      return activeContext
    }
    return this.#otel.propagation.extract(activeContext, carrier)
  }

  /**
   * @internal
   */
  getContextFromEnv(env: Record<string, unknown>): Context {
    if (!this.#otel) {
      return this.#noopContext
    }
    // https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/context/env-carriers.md
    // some tools sets only `TRACEPARENT` but not `TRACESTATE`
    const carrier: OTELCarrier = {}
    if (typeof env.TRACEPARENT === 'string') {
      carrier.traceparent = env.TRACEPARENT
    }
    if (typeof env.TRACESTATE === 'string') {
      carrier.tracestate = env.TRACESTATE
    }
    return this.getContextFromCarrier(carrier)
  }

  /**
   * @internal
   */
  getContextCarrier(context?: Context): OTELCarrier | undefined {
    if (!this.#otel) {
      return undefined
    }
    const carrier = {}
    this.#otel.propagation.inject(context || this.#otel.context.active(), carrier)
    return carrier
  }

  #callActiveSpan<T>(span: Span, callback: (span: Span) => T): T {
    const otel = this.#otel!
    let result!: T
    try {
      result = callback(span)
      if (result instanceof Promise) {
        return result
          .catch((error) => {
            span.recordException({
              name: error.name,
              message: error.message,
              stack: error.stack,
            })
            span.setStatus({
              code: otel.SpanStatusCode.ERROR,
            })
            throw error
          })
          .finally(() => span.end()) as T
      }
      return result
    }
    catch (error) {
      if (error instanceof Error) {
        span.recordException({
          name: error.name,
          message: error.message,
          stack: error.stack,
        })
        span.setStatus({
          code: otel.SpanStatusCode.ERROR,
        })
      }
      throw error
    }
    finally {
      // end sync callbcak
      if (!(result instanceof Promise)) {
        span.end()
      }
    }
  }

  /**
   * @internal
   */
  $<T>(name: string, fn: (span: Span) => T): T
  /**
   * @internal
   */
  $<T>(name: string, optionsOrFn: TracesSpanOptions, fn: (span: Span) => T): T
  /**
   * @internal
   */
  $<T>(name: string, optionsOrFn: TracesSpanOptions | ((span: Span) => T), fn?: (span: Span) => T): T {
    const callback = typeof optionsOrFn === 'function' ? optionsOrFn : fn!
    if (!this.#otel) {
      return callback(this.#noopSpan)
    }

    const otel = this.#otel
    const options = typeof optionsOrFn === 'function' ? {} : optionsOrFn
    const context = options.context
    if (context) {
      return otel.tracer.startActiveSpan(
        name,
        options,
        context,
        span => this.#callActiveSpan(span, callback),
      )
    }
    return otel.tracer.startActiveSpan(
      name,
      options,
      span => this.#callActiveSpan(span, callback),
    )
  }

  /**
   * @internal
   */
  startSpan(name: string, options?: SpanOptions, context?: Context): Span {
    if (!this.#otel) {
      return this.#noopSpan
    }
    const { tracer } = this.#otel
    return tracer.startSpan(name, options, context)
  }

  // On browser mode, async context is not automatically propagated,
  // so we manually bind the `$` calls to the provided context.
  // TODO: this doesn't bind to user land's `@optelemetry/api` calls
  /**
   * @internal
   */
  bind(context: Context) {
    if (!this.#otel) {
      return
    }
    const original = (this.$ as any).__original ?? this.$
    this.$ = this.#otel.context.bind(context, original)
    ;(this.$ as any).__original = original
  }

  /**
   * @internal
   */
  async finish(): Promise<void> {
    await this.#sdk?.shutdown()
  }

  /**
   * @internal
   */
  async flush(): Promise<void> {
    await this.#sdk?.forceFlush?.()
  }
}

function noopSpan(this: Span) {
  return this
}

function createNoopSpan(): Span {
  return {
    setAttribute: noopSpan,
    setStatus: noopSpan,
    addEvent: noopSpan,
    addLink: noopSpan,
    addLinks: noopSpan,
    setAttributes: noopSpan,
    updateName: noopSpan,
    end: () => {},
    isRecording: () => false,
    recordException: noopSpan,
    spanContext() {
      return {
        spanId: '',
        traceFlags: 0,
        traceId: '',
      }
    },
  }
}

function noopContext(this: Context) {
  return this
}

function createNoopContext(): Context {
  return {
    getValue: noopContext,
    setValue: noopContext,
    deleteValue: noopContext,
  }
}
