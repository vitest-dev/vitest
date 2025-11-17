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
import type { OTELCarrier } from '../node/pools/types'

interface TracesOptions {
  enabled: boolean
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
  // TODO: we need sdk to shutdown the server
  // is there a better way to flish events?
  #sdk: { shutdown: () => Promise<void> } | null = null
  #init: Promise<unknown> | null = null
  #noopSpan = createNoopSpan()
  #noopContext = createNoopContext()

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
        // TODO: link, message
        throw new Error(`"@opentelemetry/api" is not installed locally. Make sure you have setup OpenTelemetry instrumentation: https://svelte.dev/docs/kit/observability`)
      })
      const sdkInit = (options.sdkPath ? import(options.sdkPath!) : Promise.resolve()).catch((cause) => {
        throw new Error(`Failed to import custom OpenTelemetry SDK script: ${options.sdkPath}.`, { cause })
      })
      this.#init = Promise.all([sdkInit, apiInit]).then(([sdk]) => {
        this.#sdk = sdk?.default ?? null
      }).finally(() => {
        this.#init = null
      })
    }
  }

  public isEnabled(): boolean {
    return !!this.#otel
  }

  async waitInit(): Promise<this> {
    if (this.#init) {
      await this.#init
    }
    return this
  }

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

  $<T>(name: string, fn: (span: Span) => T): T
  $<T>(name: string, optionsOrFn: TracesSpanOptions, fn: (span: Span) => T): T
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

  startSpan(name: string, options?: SpanOptions, context?: Context): Span {
    if (!this.#otel) {
      return this.#noopSpan
    }
    const { tracer } = this.#otel
    return tracer.startSpan(name, options, context)
  }

  async finish(): Promise<void> {
    await this.#sdk?.shutdown()
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
