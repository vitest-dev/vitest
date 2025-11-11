import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node'

const traceExporter = new OTLPTraceExporter()
const sdk = new NodeSDK({
  serviceName: 'vitest',
  traceExporter,
  spanProcessors: [new BatchSpanProcessor(traceExporter)],
  instrumentations: [getNodeAutoInstrumentations()],
})

sdk.start()
export default sdk
