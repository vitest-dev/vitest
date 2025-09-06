# GitHub Copilot Instructions for Vitest Repository

This file provides specific instructions for GitHub Copilot when working in the Vitest repository.

## Repository Context

You are working in the **Vitest** repository, a next-generation testing framework powered by Vite. This is a monorepo containing multiple interconnected packages that provide a fast, modern testing experience with Jest-compatible APIs.

## Code Style and Conventions

### Language and Setup
- Use **TypeScript** with strict type checking
- Follow **ESM-first** approach (import/export, not require)
- Use **async/await** instead of Promises with `.then()`
- Prefer **functional programming** patterns over classes when appropriate
- Use **template literals** with `${}` interpolation instead of string concatenation

### Import Patterns
```typescript
// Prefer named imports
import { describe, expect, it } from 'vitest'
import { defineConfig } from 'vitest/config'

// Use type-only imports when appropriate
import type { Plugin, UserConfig } from 'vite'
import type { Suite, TestContext } from 'vitest'

// Internal package imports
import { createDefer } from '@vitest/utils'
import { parseStack } from '@vitest/utils/source-map'
```

### Function Definitions
```typescript
// Prefer function expressions for consistency
async function functionName(param: Type): Promise<ReturnType> {
  // implementation
}

// Use proper typing for test functions
function testFunction(name: string, fn: () => void | Promise<void>) {
  // implementation
}
```

### Error Handling
```typescript
// Use proper error types
try {
  // risky operation
}
catch (error: unknown) {
  if (error instanceof Error) {
    // handle known error
  }
  throw error
}
```

## Testing Patterns

### Test Structure
```typescript
import { describe, expect, it, vi } from 'vitest'

describe('feature name', () => {
  it('should do something specific', async () => {
    // Arrange
    const input = createTestInput()

    // Act
    const result = await functionUnderTest(input)

    // Assert
    expect(result).toEqual(expectedOutput)
  })

  it('should handle edge case', () => {
    expect(() => functionWithError()).toThrow('Expected error message')
  })
})
```

### Mock Patterns
```typescript
// Use vi for mocking (Vitest's mock utility)
const mockFunction = vi.fn()
const mockedModule = vi.mocked(actualModule)

// Mock with implementation
const mockWithImpl = vi.fn().mockImplementation(() => 'result')

// Spy on existing functions
const spy = vi.spyOn(object, 'method')
```

### Snapshot Testing
```typescript
// For UI components or complex objects
expect(result).toMatchSnapshot()

// For inline snapshots (preferred for small values)
expect(result).toMatchInlineSnapshot(`"expected string"`)
```

## Configuration Patterns

### Vitest Config
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node', // or 'jsdom', 'happy-dom', 'browser'
    globals: true,
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['**/*.test.ts', '**/types.ts'],
    },
  },
})
```

### Project Configuration
```typescript
// For monorepo/multi-environment setups
export default defineConfig({
  test: {
    projects: [
      {
        name: 'unit',
        test: {
          include: ['**/*.unit.test.ts'],
          environment: 'node',
        },
      },
      {
        name: 'browser',
        test: {
          include: ['**/*.browser.test.ts'],
          environment: 'browser',
          browser: {
            enabled: true,
            provider: 'playwright',
            name: 'chromium',
          },
        },
      },
    ],
  },
})
```

## Package-Specific Guidance

### Core Vitest Package (`packages/vitest/`)
- Focus on test runner functionality
- Handle configuration parsing and validation
- Implement core APIs (describe, it, expect)
- Use internal utils from `@vitest/utils`

### UI Package (`packages/ui/`)
- Vue 3 + TypeScript components
- Follow Vue composition API patterns
- Use reactive state management
- Implement WebSocket communication with test runner

### Browser Package (`packages/browser/`)
- Handle browser automation
- Implement provider abstractions (Playwright, WebDriver)
- Focus on cross-browser compatibility
- Handle iframe communication

### Coverage Packages (`packages/coverage-*/`)
- Implement coverage provider interfaces
- Handle source map processing
- Generate coverage reports
- Optimize for performance

## Common Patterns to Follow

### File Organization
```typescript
// 1. Type imports first
import type { Config, Plugin } from './types'

// 2. External library imports
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// 3. Internal package imports
import { createDefer } from '@vitest/utils'

// 4. Relative imports
import { helperFunction } from './utils'
import { CONSTANTS } from './constants'
```

### Error Messages
```typescript
// Be descriptive and actionable
throw new Error(`Failed to load config file "${configPath}". Make sure the file exists and is valid.`)

// Include helpful context
throw new Error(`Invalid test environment "${environment}". Available environments: node, jsdom, happy-dom, browser`)
```

### Plugin Development
```typescript
import type { Plugin } from 'vite'

export function vitestPlugin(): Plugin {
  return {
    name: 'vitest:plugin-name',
    configResolved(config) {
    // Handle configuration
    },
    transform(code, id) {
    // Transform code
      return { code, map: null }
    },
  }
}
```

## Performance Considerations

### Async Operations
```typescript
// Prefer Promise.all for concurrent operations
const [config, plugins] = await Promise.all([
  loadConfig(),
  loadPlugins(),
])

// Use proper cleanup
using resource = await acquireResource()
// resource will be cleaned up automatically
```

### Memory Management
```typescript
// Clear references when done
const weakMap = new WeakMap()
const cache = new Map()

// Clear cache periodically
if (cache.size > MAX_CACHE_SIZE) {
  cache.clear()
}
```

## Integration Points

### Vite Plugin Integration
```typescript
// When creating Vite plugins for Vitest
export function createVitestPlugin(): Plugin {
  return {
    name: 'vitest:custom',
    configureServer(server) {
      // Integrate with Vite dev server
    },
    handleHotUpdate(ctx) {
      // Handle HMR updates
    },
  }
}
```

### Reporter Integration
```typescript
import type { Reporter } from 'vitest'

export class CustomReporter implements Reporter {
  onStart() {
    // Initialize reporting
  }

  onTestFinished(test) {
    // Handle individual test completion
  }

  onFinished(files, errors) {
    // Handle test suite completion
  }
}
```

## CLI and Node.js Patterns

### CLI Command Structure
```typescript
import { cac } from 'cac'

const cli = cac('vitest')

cli
  .command('run [...filters]')
  .option('--reporter <name>', 'Use specified reporter')
  .action(async (filters, options) => {
    // Implementation
  })
```

### File System Operations
```typescript
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

// Always use async file operations
const content = await readFile(path, 'utf8')

// Check existence before operations
if (existsSync(configPath)) {
  const config = await loadConfig(configPath)
}
```

## Documentation and Comments

### TSDoc Comments
```typescript
/**
 * Loads and validates a Vitest configuration file.
 *
 * @param configPath - Path to the configuration file
 * @param mode - The mode to load the configuration in
 * @returns Promise resolving to the loaded configuration
 * @throws {Error} When configuration file is invalid
 */
export async function loadConfig(
  configPath: string,
  mode: 'development' | 'production' = 'development'
): Promise<UserConfig> {
  // Implementation
}
```

### Inline Comments
```typescript
// Only add comments for complex logic or workarounds
const normalizedPath = path.replace(/\\/g, '/') // Normalize Windows paths

// TODO: This is a temporary workaround for issue #123
// FIXME: Handle edge case where config is undefined
```

## Debugging and Development

### Debug Utilities
```typescript
import { createDebugger } from '@vitest/utils'

const debug = createDebugger('vitest:runner')

debug('Starting test execution with config:', config)
```

### Development Helpers
```typescript
// Use environment checks for development features
if (process.env.NODE_ENV === 'development') {
  // Development-only code
}

// Use feature flags for experimental features
if (config.experimental?.newFeature) {
  // Experimental implementation
}
```

## Important Notes

1. **Always preserve existing functionality** when making changes
2. **Add tests** for new features and bug fixes
3. **Update TypeScript types** when adding new APIs
4. **Consider backward compatibility** for configuration changes
5. **Use existing patterns** found in the codebase
6. **Follow the monorepo structure** - don't create circular dependencies
7. **Performance matters** - Vitest should be fast
8. **Browser compatibility** - consider different browser environments
9. **Node.js versions** - support Node.js >=18.0.0
10. **ESM/CJS compatibility** - handle both module systems when necessary

## Quick Commands for Reference

```bash
# Setup and build
pnpm install && pnpm run build

# Run tests
pnpm run test
pnpm run test:ci

# Development
pnpm run dev
pnpm run lint:fix

# Package-specific
cd packages/vitest && pnpm test
cd packages/ui && pnpm run dev
```

Remember: Vitest aims to provide a fast, reliable, and enjoyable testing experience. Keep this goal in mind when contributing code.
