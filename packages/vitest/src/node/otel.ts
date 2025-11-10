import type {
  ContextAPI,
  PropagationAPI,
  Span,
  SpanOptions,
  SpanStatusCode,
  Tracer,
} from '@opentelemetry/api'

interface TelemetryOptions {
  enabled: boolean
}

interface OTEL {
  tracer: Tracer
  context: ContextAPI
  SpanStatusCode: typeof SpanStatusCode
  propagation: PropagationAPI
}

export class Telemetry {
  #otel: OTEL | null = null
  #init: Promise<void> | null

  constructor(options: TelemetryOptions) {
    if (!options.enabled) {
      this.#otel = null
      this.#init = null
    }
    else {
      this.#init = import('@opentelemetry/api').then((api) => {
        const otel = {
          tracer: api.trace.getTracer('vitest'),
          context: api.context,
          propagation: api.propagation,
          SpanStatusCode: api.SpanStatusCode,
        }
        this.#otel = otel
        this.#init = null
      }).catch(() => {
        // TODO: link, message
        throw new Error(`"@opentelemetry/api" is not installed locally. Make sure you have setup OpenTelemetry instrumentation: https://svelte.dev/docs/kit/observability`)
      })
    }
  }

  async waitInit(): Promise<void> {
    if (this.#init) {
      await this.#init
    }
  }

  startActiveSpan<T>(name: string, fn: (span: Span) => T): T
  startActiveSpan<T>(name: string, optionsOrFn: SpanOptions, fn: (span: Span) => T): T
  startActiveSpan<T>(name: string, optionsOrFn: SpanOptions | ((span: Span) => T), fn?: (span: Span) => T): T {
    const callback = typeof optionsOrFn === 'function' ? optionsOrFn : fn!
    if (!this.#otel) {
      return callback(createNoopSpan())
    }

    const otel = this.#otel
    return otel.tracer.startActiveSpan(name, typeof optionsOrFn === 'function' ? {} : optionsOrFn, (span) => {
      let result!: T
      try {
        result = callback(span)
        if (result instanceof Promise) {
          return result
            .catch(error =>
              span.recordException({
                name: error.name,
                message: error.message,
                stack: error.stack,
              }),
            )
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
        }
        throw error
      }
      finally {
        // end sync callbcak
        if (!(result instanceof Promise)) {
          span.end()
        }
      }
    })
  }

  startSpan(name: string): Span {
    if (!this.#otel) {
      return createNoopSpan()
    }
    const { tracer } = this.#otel
    return tracer.startSpan(name)
  }
}

function noop(this: Span) {
  return this
}

function createNoopSpan(): Span {
  return {
    setAttribute: noop,
    setStatus: noop,
    addEvent: noop,
    addLink: noop,
    addLinks: noop,
    setAttributes: noop,
    updateName: noop,
    end: () => {},
    isRecording: () => false,
    recordException: noop,
    spanContext() {
      return {
        spanId: '',
        traceFlags: 0,
        traceId: '',
      }
    },
  }
}
