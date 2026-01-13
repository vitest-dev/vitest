import { NodeSDK } from '@opentelemetry/sdk-node'

const sdk = new NodeSDK({
  serviceName: 'vitest',
})

// sdk.start() do not start to keep traces noop,
// but Vitest will still be able to see otel
export default sdk
