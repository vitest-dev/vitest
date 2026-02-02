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

### Vary test count

```bash
FILE_COUNT=500 node generate-tests.mjs
```

## Findings

| Tests  | Files | Blob Size | Merge Time |
| ------ | ----- | --------- | ---------- |
| 10,000 | 100   | 4.3M      | 0.45s      |
| 50,000 | 500   | 22M       | 1.45s      |

## Serialization benchmark

Compare flatted vs devalue vs @ungap/structured-clone parse/stringify on blob outputs:

```bash
pnpm test bench run
```

```sh
 ✓ demo.bench.ts > parse 18821ms
     name                         hz      min     max    mean     p75     p99    p995    p999     rme  samples
   · flatted                  1.4627   661.73  724.88  683.68  699.01  724.88  724.88  724.88  ±1.96%       10
   · devalue                  8.9283  97.1357  125.28  112.00  114.71  125.28  125.28  125.28  ±4.62%       10
   · @ungap/structured-clone  3.5498   247.89  353.75  281.71  289.40  353.75  353.75  353.75  ±8.10%       10

 ✓ demo.bench.ts > stringify 17660ms
     name                         hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · flatted                  3.6988  252.01  289.50  270.36  277.55  289.50  289.50  289.50  ±2.86%       10
   · devalue                  2.1953  423.41  485.84  455.51  471.23  485.84  485.84  485.84  ±3.29%       10
   · @ungap/structured-clone  3.1401  278.85  391.83  318.46  338.29  391.83  391.83  391.83  ±8.20%       10

 BENCH  Summary
  devalue - demo.bench.ts > parse
    2.52x faster than @ungap/structured-clone
    6.10x faster than flatted
  flatted - demo.bench.ts > stringify
    1.18x faster than @ungap/structured-clone
    1.68x faster than devalue
```
