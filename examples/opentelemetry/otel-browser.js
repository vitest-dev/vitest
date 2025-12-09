import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { resourceFromAttributes } from '@opentelemetry/resources'
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
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
    new SimpleSpanProcessor(new ConsoleSpanExporter()),
    new SimpleSpanProcessor(new OTLPTraceExporter()),
  ],
})

provider.register({
  // contextManager: new ZoneContextManager(),
})

export default provider
