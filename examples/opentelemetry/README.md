# Vitest Opentelemtry Example

- **Documentation**: https://vitest.dev/guide/open-telemetry.html

## Usage

```sh
# Start Jaeger service to receive otlp traces over http
# and serve Web UI at http://localhost:16686
docker compose up -d

# Run tests (exports with OTLP HTTP by deafult)
pnpm test --experimental.openTelemetry.enabled

# Use console exporter for quick debugging
OTEL_TRACES_EXPORTER=console pnpm test --experimental.openTelemetry.enabled

# Run browser mode
pnpm test --experimental.openTelemetry.enabled --browser.enabled
```
