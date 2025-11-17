# Open Telemetry Support <Experimental /> {#open-telemetry-support}

OpenTelemetry traces can be a useful tool to debug the performance and behavior of your application inside tests.

Vitest integration starts active spans that are scoped to the test worker.

::: warning
OpenTelemetry initialization increases the startup time of every test unless Vitest runs without [isolation](/config/isolate). You can see it as the `vitest.runtime.traces` span inside `vitest.worker.start`.
:::

You can use the OpenTelemetry API yourself to track certain operations in your code. Custom traces automatically inherit the Vitest OpenTelemetry context.

To start using OpenTelemetry in Vitest, specify an SDK module path via [`experimental.openTelemetry.sdkPath`](/config/experimental#opentelemetry) and set `experimental.openTelemetry.enabled` to `true`. Vitest will automatically load the SDK before running all tests and inside of each worker.

Make sure to export the SDK as a default export, so that Vitest can flush the network requests before the process is closed. Note that Vitest doesn't automatically call `start`.

::: code-group
```js{12} [otel.js]
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { NodeSDK } from '@opentelemetry/sdk-node'

const sdk = new NodeSDK({
  serviceName: 'vitest',
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
})

sdk.start()
export default sdk
```
```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    experimental: {
      openTelemetry: {
        enabled: true,
        sdkPath: './otel.js',
      },
    },
  },
})
```
:::

::: danger FAKE TIMERS
If you are using fake timers, it is important to reset them before the test ends, otherwise traces might not be tracked properly.
:::

Vitest doesn't process the `sdkPath` module, so it is important that the SDK can be imported within your Node.js environment. It is ideal to use the `.js` extension for this file. Using another extension will slow down your tests and may require providing additional Node.js arguments.

If you want to provide a TypeScript file, make sure to familiarize yourself with [TypeScript](https://nodejs.org/api/typescript.html#type-stripping) page in the Node.js documentation.

## View Traces

To generate traces, run Vitest as usual. It is preferable to run Vitest in [watch mode](/config/watch), so OpenTelemetry has enough time to process and send HTTP requests properly.

You can view traces using any of the open source or commercial products that support OpenTelemetry API. If you did not use OpenTelemetry before, we recommend starting with [Jaeger](https://www.jaegertracing.io/docs/2.11/getting-started/#all-in-one) because it is really easy to setup.

<img src="/otel-jaeger.png" />
