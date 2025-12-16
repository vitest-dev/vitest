# Blob Reporter JSON Size Optimization

https://github.com/vitest-dev/vitest/issues/9216

## Problem

The blob reporter (`packages/vitest/src/node/reporters/blob.ts`) produces large JSON files due to the `importDurations` structure on each `File`. This scales by **(number of test files) × (number of source files)**, causing significant bloat in sharded test runs.

## Structure Analysis

Each `File` has:
```typescript
importDurations?: Record<string, ImportDuration>
```

Where `ImportDuration` contains:
```typescript
interface ImportDuration {
  selfTime: number
  totalTime: number
  external?: boolean
  importer?: string
}
```

### Bloat Sources

1. **Repeated module path keys** - Same paths (e.g., `/home/user/project/src/utils/helpers.ts`) appear in every test file that imports them
2. **Repeated importer strings** - The `importer` field also contains full paths
3. **Excessive numeric precision** - `performance.now()` returns floats like `1.2345678901234567` (15-20 chars when serialized)

## Optimization Strategies

### 1. String Interning (Dictionary Encoding)

Deduplicate repeated strings into a string table, reference by index:

```typescript
// Before: keys repeated per file
file1: { "/path/to/module.ts": { importer: "/path/to/test.ts", ... } }
file2: { "/path/to/module.ts": { importer: "/path/to/test2.ts", ... } }

// After: string table + indices
keys: ["/path/to/module.ts", "/path/to/test.ts", "/path/to/test2.ts"]
file1: [[0, { importer: 1, ... }]]
file2: [[0, { importer: 2, ... }]]
```

**Expected savings**: 10-15x reduction on importDurations keys alone.

### 2. Numeric Precision Reduction

Use `x.toPrecision(3)` and **store as string** to guarantee compact representation:

```typescript
// Store as string (guaranteed compact)
const compact = n.toPrecision(3) // "1.23" or "1.23e-7"

// Restore as number (accept precision loss)
const restored = Number(compact)
```

**Important**: `Number(n.toPrecision(3))` then re-serializing can expand again due to float representation. Storing as string avoids this.

| Raw Value | toPrecision(3) | Savings |
|-----------|----------------|---------|
| `1.2345678901234567` | `"1.23"` | 17 → 4 chars |
| `123.456789` | `"123"` | 10 → 3 chars |
| `0.0000001234` | `"1.23e-7"` | variable → 7 chars |

### 3. Schema-based Encoding (Object → Tuple)

Replace keyed objects with positional tuples:

```typescript
// Before
{ selfTime: 1.23, totalTime: 4.56, external: true, importer: "/path" }

// After: [selfTime, totalTime, external?, importerKeyIndex?]
[1.23, 4.56, true, 42]
```

### 4. Combined Optimized Format

```typescript
interface OptimizedFilesReport {
  files: File[] // with importDurations removed
  importDurations: {
    keys: string[] // string table of all module paths
    // [fileIndex, [[keyIndex, selfTime, totalTime, external?, importerKeyIndex?], ...]]
    values: [number, (number | boolean | undefined)[][]][]
  }
}
```

### 5. Post-serialization Compression (gzip)

Simple and effective - JSON compresses extremely well:

```typescript
import { gunzipSync, gzipSync } from 'node:zlib'

// Write
await writeFile(`${filename}.gz`, gzipSync(stringify(report)))

// Read
const content = gunzipSync(await readFile(`${filename}.gz`)).toString()
```

**Expected savings**: 70-90% reduction with minimal code changes.

## Comparison

| Approach | Implementation Effort | Size Reduction | Debuggability |
|----------|----------------------|----------------|---------------|
| String interning | Medium | 50-70% | Good (JSON) |
| Numeric precision | Low | 10-20% | Good (JSON) |
| Object → Tuple | Medium | 20-30% | Poor |
| gzip compression | Low | 70-90% | Poor (binary) |
| All combined | High | 90-95% | Poor |

## Constraints

- **JS string limit (~500MB)**: The serialized JSON string itself can exceed JS limits before writing to disk
- **Streaming serialization** was explored in https://github.com/vitest-dev/vitest/pull/9255, but the conclusion was that the data structure shouldn't reach that size in the first place
- Post-serialization compression (gzip) doesn't help with the in-memory string size problem

## Recommendation

Focus on **reducing data size before serialization**:

1. **String interning** - Deduplicate module paths into a string table (highest impact)
2. **Numeric precision** - `toPrecision(3)` on timing values
3. **Tuple encoding** - Replace objects with positional arrays

gzip can be added as a secondary optimization for file size on disk, but doesn't solve the core problem.

## Implementation Notes

Existing stub functions in `blob.ts`:
- `optimizeFilesReport()` - partially implemented, needs completion
- `restoreOptimizedFilesReport()` - stub only

These would need to be integrated into `writeBlob()` and `readBlobs()` respectively.
