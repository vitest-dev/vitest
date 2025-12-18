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
VITEST_DEBUG_DUMP=true pnpm test
```

This will create a `.vitest-dump` folder in the project root with all transformed files.

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
VITEST_DEBUG_DUMP=true pnpm test barrel-import
```

Check `.vitest-dump/` - you'll see that ALL files in the utils directory are transformed, even though only `currency.ts` is needed.

### Test with direct import:

```bash
VITEST_DEBUG_DUMP=true pnpm test direct-import
```

Check `.vitest-dump/` - you'll see that ONLY the necessary files are transformed.

## Expected Behavior

When using the barrel file import (`../src/utils`):
- ✅ All utility files are transformed (currency, time, math, location, users)
- ⚠️ This causes unnecessary overhead

When using direct imports (`../src/utils/currency`):
- ✅ Only the needed file is transformed (currency)
- ✅ Better performance

## Debugging Tips

1. Run tests with `VITEST_DEBUG_DUMP=true`
2. Inspect the `.vitest-dump` directory
3. Look for files that shouldn't be there
4. Refactor imports to avoid barrel files where possible
5. Use the Vitest UI to visualize the module graph

## Clean Up

The `.vitest-dump` directory is temporary and can be safely deleted or added to `.gitignore`.
