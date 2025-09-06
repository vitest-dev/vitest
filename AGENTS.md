# Vitest - Guide for Code Agents

This document provides comprehensive guidance for code agents working with the Vitest repository, a next-generation testing framework powered by Vite.

## Repository Overview

Vitest is a monorepo containing a modern testing framework that provides a fast, Vite-powered testing experience with Jest-compatible APIs. The repository uses pnpm workspaces and contains multiple interconnected packages.

### Key Technologies & Requirements

- **Node.js**: >=18.0.0 (required)
- **Package Manager**: pnpm (version 10.15.0 specified in packageManager field)
- **Language**: TypeScript/JavaScript with ESM-first approach
- **Build Tool**: Vite for development and bundling
- **Linting**: ESLint with @antfu/eslint-config
- **Testing**: Self-tested using Vitest itself

## Repository Structure

```
vitest/
├── packages/          # Core monorepo packages
│   ├── vitest/        # Main vitest package
│   ├── browser/       # Browser mode support
│   ├── ui/           # Web UI for test visualization
│   ├── coverage-v8/   # V8 coverage provider
│   ├── coverage-istanbul/ # Istanbul coverage provider
│   ├── runner/        # Test runner core
│   ├── snapshot/      # Snapshot testing utilities
│   └── ...           # Additional utilities and plugins
├── docs/             # VitePress documentation
├── examples/         # Example projects and configurations
├── test/            # Test suites for the framework itself
├── scripts/         # Build and maintenance scripts
└── .github/         # GitHub workflows and templates
```

### Key Packages

1. **vitest** - Main package containing the core testing framework
2. **@vitest/ui** - Web-based test runner interface
3. **@vitest/browser** - Browser mode for running tests in real browsers
4. **@vitest/coverage-v8** - Native V8 coverage reporting
5. **@vitest/coverage-istanbul** - Istanbul-based coverage reporting
6. **@vitest/runner** - Core test execution engine

## Development Workflow

### Setup Commands

```bash
# Install dependencies (required)
pnpm install

# Build all packages (required before testing)
pnpm run build

# Development mode with watch (for active development)
pnpm run dev
```

### Testing Commands

```bash
# Run core tests
pnpm run test

# Run full CI test suite (comprehensive)
pnpm run test:ci

# Run specific test suite
cd test/(directory) && pnpm run test

# Test examples
pnpm run test:examples

# Browser testing
pnpm run test:browser:playwright
pnpm run test:browser:webdriverio
```

### Code Quality Commands

```bash
# Lint all code
pnpm run lint

# Fix linting issues automatically
pnpm run lint:fix

# Type checking
pnpm run typecheck
```

### Documentation Commands

```bash
# Start documentation development server
pnpm run docs

# Build documentation
pnpm run docs:build

# Update contributors list
pnpm run docs:contributors
```

## Core Concepts for Agents

### 1. Test Framework Architecture

Vitest is built around these key concepts:

- **Vite Integration**: Leverages Vite's transform pipeline for instant feedback
- **Jest Compatibility**: Provides familiar Jest APIs while being faster
- **ESM Native**: Built for modern JavaScript with top-level await support
- **Multi-Environment**: Supports Node.js, JSDOM, happy-dom, and browser environments

### 2. Configuration System

Vitest uses a flexible configuration system:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Test configuration
    environment: 'node', // 'node' | 'jsdom' | 'happy-dom' | 'browser'
    globals: true,
    coverage: {
      provider: 'v8', // 'v8' | 'istanbul' | 'custom'
    },
    // Projects for monorepo/multi-config support
    projects: ['packages/*'],
  },
})
```

### 3. Project/Workspace Support

Vitest supports running multiple test configurations in a single process:

- **Projects**: Different configurations for different parts of codebase
- **Monorepo Support**: Automatic detection of workspace packages
- **Environment Isolation**: Each project can have different environments

### 4. Browser Mode

Vitest can run tests in real browsers:

- **Providers**: Playwright, WebDriver, or custom
- **Real DOM**: Actual browser environment instead of JSDOM simulation
- **Component Testing**: Support for Vue, React, Svelte, etc.

## File Patterns and Conventions

### Test File Patterns

```
**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}
**/__tests__/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}
```

### Configuration Files

- `vitest.config.{js,ts,mjs,mts}` - Main configuration
- `vitest.workspace.{js,ts,mjs,mts}` - Workspace configuration (deprecated, use projects)

### Common Directories

- `test/` - Framework's own tests
- `packages/*/test/` - Package-specific tests
- `examples/*/test/` - Example tests

## Common Development Tasks

### Adding a New Feature

1. **Identify the Package**: Determine which package needs modification
2. **Write Tests First**: Add tests in appropriate test directory
3. **Implement Feature**: Make minimal changes to implement functionality
4. **Update Types**: Add TypeScript definitions if needed
5. **Update Documentation**: Add docs if it's a user-facing feature
6. **Test Thoroughly**: Run relevant test suites

### Fixing Bugs

1. **Reproduce Issue**: Create a minimal reproduction case
2. **Write Regression Test**: Add test that fails with the bug
3. **Fix Issue**: Make minimal code changes
4. **Verify Fix**: Ensure test passes and no regressions
5. **Consider Edge Cases**: Test boundary conditions

### Working with Dependencies

Vitest aims to be lightweight:

- **Prefer devDependencies**: Most deps should be devDependencies
- **Bundle Analysis**: Consider package size impact
- **Type Dependencies**: Use @types/* packages when needed
- **Runtime Dependencies**: Only for essential runtime functionality

## Testing Vitest Itself

### Test Categories

1. **Unit Tests**: Individual function/module testing
2. **Integration Tests**: Cross-package functionality
3. **Example Tests**: Real-world usage scenarios
4. **Browser Tests**: Browser-specific functionality
5. **E2E Tests**: Full workflow testing

### Running Specific Tests

```bash
# Test specific package
cd packages/vitest && pnpm test

# Test with specific environment
pnpm test --environment=jsdom

# Test with specific coverage provider
pnpm test --coverage.provider=v8

# Test browser mode
pnpm test:browser:playwright
```

## Debugging

### VS Code Debugging

1. Add `debugger` statement in code
2. Use "Run and Debug" in VS Code
3. Select "JavaScript Debug Terminal"
4. Run test command in debug terminal

### Common Debug Patterns

```bash
# Run single test file
npx vitest run path/to/test.spec.ts

# Run with debug info
DEBUG=vitest:* npx vitest

# Run with Node debugging
node --inspect-brk ./node_modules/.bin/vitest
```

## API and Extension Points

### Custom Reporters

```typescript
import type { Reporter } from 'vitest'

export default class CustomReporter implements Reporter {
  onStart() { /* setup */ }
  onTestFinished() { /* handle test result */ }
  onEnd() { /* cleanup */ }
}
```

### Custom Coverage Providers

```typescript
import type { CoverageProvider } from 'vitest'

export default class CustomCoverageProvider implements CoverageProvider {
  // Implement coverage collection logic
}
```

### Plugins

Vitest supports Vite plugins for extending functionality:

```typescript
import { defineConfig } from 'vitest/config'
import customPlugin from './custom-plugin'

export default defineConfig({
  plugins: [customPlugin()],
  test: { /* config */ }
})
```

## Contributing Guidelines

### Code Style

- Follow existing ESLint configuration
- Use TypeScript for type safety
- Prefer functional programming patterns
- Write clear, descriptive commit messages
- Keep changes minimal and focused

### PR Requirements

- Add tests for new functionality
- Update documentation if needed
- Follow commit message convention
- Ensure all CI checks pass
- Get approval from maintainers

### Issue Reporting

- Use provided issue templates
- Include minimal reproduction
- Specify environment details
- Check for existing similar issues

## Common Pitfalls for Agents

1. **Don't skip pnpm install**: Always install dependencies first
2. **Build before testing**: Run `pnpm run build` before running tests
3. **Respect monorepo structure**: Don't modify cross-package dependencies casually
4. **Check existing tests**: Look for similar test patterns before adding new ones
5. **Understand async nature**: Many operations are async due to Vite's architecture
6. **Environment context**: Be aware of test environment (node/browser/jsdom)
7. **TypeScript compilation**: Changes may require rebuilding TypeScript

## Useful Resources

- **Documentation**: [vitest.dev](https://vitest.dev)
- **Examples**: `/examples` directory in repository
- **Contributing Guide**: `CONTRIBUTING.md`
- **API Reference**: [vitest.dev/api](https://vitest.dev/api)
- **GitHub Issues**: For bug reports and feature requests
- **Discord**: Community support and discussions

## Quick Reference Commands

```bash
# Complete setup and test
pnpm install && pnpm run build && pnpm run test

# Development workflow
pnpm run dev  # Start development mode
pnpm run test:ci  # Full test suite
pnpm run lint:fix  # Fix code style

# Package-specific work
cd packages/vitest && pnpm test
cd packages/ui && pnpm run dev

# Documentation
pnpm run docs  # Start docs dev server
pnpm run docs:build  # Build docs
```

This guide should help code agents understand and work effectively with the Vitest repository structure, workflows, and conventions.
