// @ts-check
import { NodeSDK } from '@opentelemetry/sdk-node'

const sdk = new NodeSDK({
  serviceName: 'vitest',
  // by default, it uses "@opentelemetry/exporter-trace-otlp-proto"
  // traceExporter
})
sdk.start()
export default sdk
