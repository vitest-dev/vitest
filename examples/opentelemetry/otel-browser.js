import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchSpanProcessor, WebTracerProvider } from '@opentelemetry/sdk-trace-web'

const provider = new WebTracerProvider({
  resource: resourceFromAttributes({
    'service.name': 'vitest-browser',
  }),
  spanProcessors: [
    new BatchSpanProcessor(new OTLPTraceExporter()),
    // you can add a ConsoleSpanExporter for debugging purposes
    // (available in @opentelemetry/sdk-trace-web)
    // new SimpleSpanProcessor(new ConsoleSpanExporter()),
  ],
})

provider.register({
  // you can customize contextManager but browser support has limitation
  // cf. https://github.com/open-telemetry/opentelemetry-js/discussions/2060
  // contextManager: new StackContextManager(), // this is the default (avialable in sdk-trace-web)
  // contextManager: new ZoneContextManager(), // doesn't seem to help (avialable in @opentelemetry/context-zone)
})

export default provider
