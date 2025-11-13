# Open Telemetry Support <Experimental /> {#open-telemetry-support}

OpenTelemetry can be a useful tool to debug the performance and behaviour of your application inside of tests.

Vitest integration starts active spans that are scoped to the test worker.

The OpenTelemetry initialisation is also shown in traces as `vitest.runtime.telemetry` span.

::: danger
It is important to reset fake timers before the test ends, otherwise traces might not be tracked properly.
:::

You can use OpenTelemetry API yourself to track certain operations in your code. <!-- example --> Custom traces automatically inherit the Vitest OpenTelemetry context.
