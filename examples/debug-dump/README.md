# VITEST_DEBUG_DUMP Example

This example demonstrates the `VITEST_DEBUG_DUMP` feature for debugging file transformation issues in Vitest.

Related to: https://github.com/vitest-dev/vitest/discussions/9290

## What is VITEST_DEBUG_DUMP?

`VITEST_DEBUG_DUMP` is an environment variable that enables Vitest to write transformed files to the filesystem. This is useful for:

- Debugging barrel file issues
- Understanding what files are being transformed
- Inspecting the transformed code
- Identifying unnecessary imports and transformations

## File Structure

```
src/
  utils/
    currency.ts      - Currency formatting utility
    time.ts          - Date formatting utility
    math.ts          - Math utilities
    location.ts      - Location utilities
    users.ts         - User utilities
    index.ts         - Barrel file (exports all utilities)
test/
  barrel-import.test.ts  - Test that imports from barrel file
  direct-import.test.ts  - Test that imports directly
```

## Usage

### Enable dump via environment variable (recommended):

```bash
VITEST_DEBUG_DUMP=true pnpm test --run
```

This will create a `.vitest-dump/root/` folder in the project root with a `vitest-metadata.json` file containing information about transformed files.

### Enable dump via config:

Uncomment the configuration in `vitest.config.ts`:

```ts
export default defineConfig({
  test: {
    server: {
      debug: {
        dump: true,
      },
    },
  },
})
```

### Custom dump directory:

```bash
VITEST_DEBUG_DUMP=my-custom-dir pnpm test
```

Or in config:

```ts
export default defineConfig({
  test: {
    server: {
      debug: {
        dump: 'my-custom-dir',
      },
    },
  },
})
```

## Observing the Difference

### Test with barrel import:

```bash
VITEST_DEBUG_DUMP=true pnpm test --run barrel-import
```

Check `.vitest-dump/root/vitest-metadata.json` - you'll see that ALL files in the utils directory are transformed:

```json
{
  "outline": {
    "externalized": 0,
    "inlined": 7 // 7 files transformed!
  },
  "duration": {
    "/test/barrel-import.test.ts": [/* timing data */],
    "/src/utils/index.ts": [/* timing data */], // barrel file
    "/src/utils/currency.ts": [/* timing data */], // ✓ needed
    "/src/utils/time.ts": [/* timing data */], // ✗ not needed
    "/src/utils/math.ts": [/* timing data */], // ✗ not needed
    "/src/utils/location.ts": [/* timing data */], // ✗ not needed
    "/src/utils/users.ts": [/* timing data */] // ✗ not needed
  }
}
```

### Test with direct import:

```bash
VITEST_DEBUG_DUMP=true pnpm test --run direct-import
```

Check `.vitest-dump/root/vitest-metadata.json` - you'll see that ONLY the necessary files are transformed:

```json
{
  "outline": {
    "externalized": 0,
    "inlined": 2 // Only 2 files!
  },
  "duration": {
    "/test/direct-import.test.ts": [/* timing data */],
    "/src/utils/currency.ts": [/* timing data */] // ✓ only what's needed
  }
}
```

## Expected Behavior

When using the barrel file import (`../src/utils`):
- ⚠️ All utility files are transformed (currency, time, math, location, users) = **7 files**
- ⚠️ This causes unnecessary overhead and slower test execution

When using direct imports (`../src/utils/currency`):
- ✅ Only the needed file is transformed (currency) = **2 files** (test + source)
- ✅ Better performance (71% fewer files transformed in this example)

## Debugging Tips

1. Run tests with `VITEST_DEBUG_DUMP=true`
2. Inspect the `.vitest-dump/root/vitest-metadata.json` file
3. Look at the `"inlined"` count and `"duration"` entries to see which files were transformed
4. Files that shouldn't be there indicate barrel file issues
5. Refactor imports to avoid barrel files where possible
6. Use the Vitest UI to visualize the module graph

## Clean Up

The `.vitest-dump` directory is temporary and can be safely deleted or added to `.gitignore`.
