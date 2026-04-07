// @ts-check
import { NodeSDK } from '@opentelemetry/sdk-node'

const sdk = new NodeSDK({
  serviceName: 'vitest',

  // NodeSDK uses "@opentelemetry/exporter-trace-otlp-proto" by default.
  // you can override it via `traceExporter` options.
  // traceExporter: ...,

  // you can configure additional instrumentations such as `@opentelemetry/auto-instrumentations-node`
  // via `instrumentations` options.
  // instrumentations: ...
})
sdk.start()
export default sdk
