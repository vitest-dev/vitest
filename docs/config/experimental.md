---
title: experimental | Config
outline: deep
---

# experimental

## openTelemetry <Version type="experimental">4.0.10</Version>

- **Type:**

```ts
interface OpenTelemetryOptions {
  enabled: boolean
  /**
   * A path to a file that exposes an OpenTelemetry SDK.
   */
  sdkPath?: string
}
```

- **Default:** `{ enabled: false }`

This option controls [OpenTelemetry](https://opentelemetry.io/) support. Vitest imports the SDK file in the main thread and before every test file, if `enabled` is set to `true`.

::: danger PERFORMANCE CONCERNS
OpenTelemetry may significantly impact Vitest performance; enable it only for local debugging.
:::

You can use a [custom service](/guide/open-telemetry) together with Vitest to pinpoint which tests or files are slowing down your test suite.

::: warning BROWSER SUPPORT
At the moment, Vitest does not start any spans when running in [the browser](/guide/browser/).
:::

An `sdkPath` is resolved relative to the [`root`](/config/root) of the project and should point to a module that exposes a started SDK instance as a default export. For example:

::: code-group
```js [otel.js]
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

::: warning
It's important that Node can process `sdkPath` content because it is not transformed by Vitest. See [the guide](/guide/open-telemetry) on how to work with OpenTelemetry inside of Vitest.
:::
