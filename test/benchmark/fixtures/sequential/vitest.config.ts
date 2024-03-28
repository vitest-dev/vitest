import { defineConfig } from "vitest/config"

// to see the difference better, increase sleep time and iterations e.g. by
// SLEEP_BENCH_MS=100 pnpm -C test/benchmark test bench -- --root fixtures/sequential --fileParallelism

export default defineConfig({
  test: {
    globalSetup: ["./setup.ts"]
  }
});
