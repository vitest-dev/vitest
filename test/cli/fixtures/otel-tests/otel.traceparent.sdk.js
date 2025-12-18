import { NodeSDK } from '@opentelemetry/sdk-node'
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base'
import fs from 'node:fs'
import path from 'node:path'

const exporter = new InMemorySpanExporter()

const sdk = new NodeSDK({
  serviceName: 'vitest-traceparent-test',
  spanProcessors: [
    {
      onStart: () => {},
      onEnd: (span) => {
        // Write span information to a file for verification
        const spanInfo = {
          name: span.name,
          traceId: span.spanContext().traceId,
          spanId: span.spanContext().spanId,
          parentSpanId: span.parentSpanId,
        }
        const outputPath = path.join(process.cwd(), 'spans.json')
        let spans = []
        if (fs.existsSync(outputPath)) {
          spans = JSON.parse(fs.readFileSync(outputPath, 'utf-8'))
        }
        spans.push(spanInfo)
        fs.writeFileSync(outputPath, JSON.stringify(spans, null, 2))
      },
      forceFlush: async () => {},
      shutdown: async () => {},
    },
  ],
})

sdk.start()
export default sdk
