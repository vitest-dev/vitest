# Blob Reporter Benchmark

Benchmark for blob reporter output size and merge-reports execution time.

## Usage

```bash
# Generate test files (default: 100 files × 100 tests = 10,000 tests)
pnpm generate

# Run with blob reporter
pnpm test:blob

# Check blob size
ls -lh .vitest-reports/blob.json

# Run merge-reports (use direct node to eliminate pnpm overhead)
time node node_modules/vitest/vitest.mjs run --merge-reports .vitest-reports --reporter=json
```

### Vary test count

```bash
FILE_COUNT=500 node generate-tests.mjs
```

## Findings

| Tests  | Files | Blob Size | Merge Time |
| ------ | ----- | --------- | ---------- |
| 10,000 | 100   | 4.3M      | 0.45s      |
| 50,000 | 500   | 22M       | 1.45s      |
