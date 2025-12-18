# Reproduction for Issue 9290

Related to: https://github.com/vitest-dev/vitest/discussions/9290

## Problem

When using `vi.mock('./module', { spy: true })`, coverage information is **not collected** for the mocked module. However, using the more verbose manual spy approach **does collect** coverage.

This is problematic because both approaches execute the actual module code, so they should both collect coverage information.

## File Structure

```
src/
  module.ts              - Module to be mocked and tested
test/
  short.test.ts          - Uses { spy: true } (DOES NOT collect coverage ❌)
  verbose.test.ts        - Uses manual spy setup (DOES collect coverage ✅)
```

## Reproduction Steps

### 1. Run test with `{ spy: true }` approach

```bash
pnpm run coverage:short
```

**Expected**: Coverage should be collected for `src/module.ts`
**Actual**: No coverage is collected ❌

### 2. Run test with manual spy approach

```bash
pnpm run coverage:verbose
```

**Expected**: Coverage should be collected for `src/module.ts`
**Actual**: Coverage IS collected ✅

## The Issue

### Approach 1: Using `{ spy: true }` (doesn't collect coverage)

```ts
import something from './module'

vi.mock('./module', { spy: true })

test('test', () => {
  something(5) // Code executes but coverage is not collected ❌
})
```

### Approach 2: Manual spy (does collect coverage)

```ts
import something from './module'

vi.mock('./module', async () => {
  const actual = await vi.importActual<typeof import('./module')>('./module')
  return {
    ...actual,
    default: vi.spyOn(actual, 'default'),
  }
})

test('test', () => {
  something(5) // Code executes and coverage IS collected ✅
})
```

## Expected Behavior

Both approaches should collect coverage information since they both:
1. Execute the actual module code
2. Spy on the module's exports
3. Allow the test to verify the code was called

The `{ spy: true }` option is supposed to be a convenient shorthand for the manual spy approach, so they should behave identically with respect to coverage collection.

## Impact

This inconsistency means developers have to:
- Use the more verbose approach to get accurate coverage reports
- This defeats the purpose of the convenient `{ spy: true }` option
- Coverage reports are inaccurate when using `{ spy: true }`
- Developers may not realize their coverage is incomplete

## Running the Example

```bash
# Run both tests normally
pnpm test

# Run with coverage to see the difference
pnpm run coverage:short    # No coverage collected
pnpm run coverage:verbose  # Coverage collected
```

Look at the coverage output to see that `src/module.ts` is only covered when using the verbose approach.
