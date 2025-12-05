# Vitest Opentelemtry Demo

```sh
# Start Jaeger service to receive otlp traces over http
# and serve Web UI at http://localhost:16686
docker compose up

# Run tests (exports with OTLP HTTP by deafult)
pnpm test --experimental.openTelemetry.enabled

# Use console exporter
OTEL_TRACES_EXPORTER=console pnpm test --experimental.openTelemetry.enabled

# Run browser mode
pnpm test --experimental.openTelemetry.enabled --browser.enabled

# Open http://localhost:16686
```
