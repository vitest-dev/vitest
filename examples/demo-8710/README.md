# Blob Reporter Benchmark

Benchmark for blob reporter output size and merge-reports execution time.

## Usage

```bash
# Run all steps (generate, blob, size, merge)
pnpm benchmark

# Generate test files (default: 100 files × 100 tests = 10,000 tests)
pnpm generate

# Run with blob reporter
pnpm test:blob

# Check blob size
ls -lh .vitest-reports/blob.json

# Run merge-reports (use direct node to eliminate pnpm overhead)
time node node_modules/vitest/vitest.mjs run --merge-reports --reporter=json --outputFile.json=./node_modules/.tmp/report.json
```

## Serialization benchmark

Compare flatted vs devalue parse/stringify on blob outputs:

```bash
pnpm vitest bench

# Override paths
FLATTED_FILE=fixtures/blob-500-flatted.json DEVALUE_FILE=fixtures/blob-500-devalue.json pnpm bench:serialization
```

```sh
 ✓ demo.bench.ts > parse 13675ms
     name         hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · flatted  1.4813  654.90  698.91  675.07  681.74  698.91  698.91  698.91  ±1.50%       10
   · devalue  8.5044  102.90  144.30  117.59  121.12  144.30  144.30  144.30  ±7.98%       10

 ✓ demo.bench.ts > stringify 12003ms
     name         hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · flatted  3.9107  244.26  291.56  255.71  259.84  291.56  291.56  291.56  ±3.96%       10
   · devalue  2.2498  403.63  509.75  444.49  485.17  509.75  509.75  509.75  ±6.65%       10
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
