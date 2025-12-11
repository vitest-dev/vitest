import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { resourceFromAttributes } from '@opentelemetry/resources'
import {
  BatchSpanProcessor,
  // ConsoleSpanExporter,
  // SimpleSpanProcessor,
  // StackContextManager,
  WebTracerProvider,
} from '@opentelemetry/sdk-trace-web'
// import { ZoneContextManager } from '@opentelemetry/context-zone';
// import { registerInstrumentations } from '@opentelemetry/instrumentation';
// import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';

const provider = new WebTracerProvider({
  resource: resourceFromAttributes({
    'service.name': 'vitest-browser',
  }),
  spanProcessors: [
    new BatchSpanProcessor(new OTLPTraceExporter()),
    // new SimpleSpanProcessor(new ConsoleSpanExporter()),
  ],
})

provider.register({
  // https://github.com/open-telemetry/opentelemetry-js/discussions/2060
  // contextManager: new StackContextManager(), // this is the default
  // contextManager: new ZoneContextManager(), // doesn't seem to help
})

export default provider
