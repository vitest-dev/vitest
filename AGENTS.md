# Vitest AI Agent Guide

This document provides comprehensive information for AI agents working on the Vitest codebase.

## Project Overview

Vitest is a next-generation testing framework powered by Vite. This is a monorepo using pnpm workspaces with the following key characteristics:

- **Language**: TypeScript/JavaScript (ESM-first)
- **Package Manager**: pnpm (required)
- **Node Version**: ^20.0.0 || ^22.0.0 || >=24.0.0
- **Build System**: Vite + Rollup
- **Monorepo Structure**: 15+ packages in `packages/` directory

## Setup and Development

### Initial Setup
1. Run `pnpm install` to install dependencies
2. Run `pnpm build` to build all packages
3. Install Playwright browsers when working with browser features: `npx playwright install --with-deps`

### Key Scripts
- `pnpm build` - Build all packages
- `pnpm dev` - Watch mode for development
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix linting issues automatically
- `pnpm typecheck` - Run TypeScript type checking

## Testing

### Running Tests
- **All tests**: `CI=true pnpm test:ci`
- **Examples**: `CI=true pnpm test:examples`
- **Specific test suite**: `CI=true cd test/<test-folder> && pnpm test <test-file>`
- **Core directory test**: `CI=true pnpm test <test-file>` (for `test/core`)
- **Browser tests**: `CI=true pnpm test:browser:playwright` or `CI=true pnpm test:browser:webdriverio`

When writing tests, AVOID using `toContain` for validation. Prefer using `toMatchInlineSnapshot` to include the test error and its stack. If snapshot is failing, update the snapshot instead of reverting it to `toContain`.

If you need to typecheck tests, run `pnpm typecheck` from the root of the workspace.

### Testing Utilities
- **`runInlineTests`** from `test/test-utils/index.ts` - You must use this for complex file system setups (>1 file)
- **`runVitest`** from `test/test-utils/index.ts` - You can use this to run Vitest programmatically
- **No mocking policy** - You must never mock anything in tests

## Project Structure

### Core Packages (`packages/`)
- `vitest` - Main testing framework
- `browser` - Browser testing support
- `ui` - Web UI for test results
- `runner` - Test runner core
- `expect` - Assertion library
- `spy` - Mocking and spying utilities
- `snapshot` - Snapshot testing
- `coverage-v8` / `coverage-istanbul` - Code coverage
- `utils` - Shared utilities
- `mocker` - Module mocking

### Test Organization (`test/`)
- `test/core` - Core functionality tests
- `test/browser` - Browser-specific tests
- Various test suites organized by feature

### Important Directories
- `docs/` - Documentation (Vite-powered)
- `examples/` - Example projects and integrations
- `scripts/` - Build and development scripts
- `.github/` - GitHub Actions workflows
- `patches/` - Package patches via pnpm

## Code Style and Conventions

### Formatting and Linting
- **Always run** `pnpm lint:fix` after making changes
- Fix non-auto-fixable errors manually

### TypeScript
- Strict TypeScript configuration
- Use `pnpm typecheck` to verify types
- Configuration files: `tsconfig.base.json`, `tsconfig.build.json`, `tsconfig.check.json`

### Code Quality
- ESM-first approach
- Follow existing patterns in the codebase
- Use utilities from `@vitest/utils/*` when available. Never import from `@vitest/utils` main entry point directly.
- Do not add comments explaining what the line does unless prompted to.

## Common Workflows

### Adding New Features
1. Identify the appropriate package in `packages/`
2. Follow existing code patterns
3. Add tests using testing utilities
4. Run `pnpm build && pnpm typecheck && pnpm lint:fix`
5. Add tests with relevant test suites

### Debugging
- Use VS Code: `⇧⌘B` (Shift+Cmd+B) or `Ctrl+Shift+B` for dev tasks
- Check `scripts/` directory for specialized development tools

### Documentation
- Main docs in `docs/` directory
- Built with `pnpm docs:build`
- Local dev server: `pnpm docs`
- When adding cli options, run `pnpm -C docs run cli-table` to update the cli-generated.md file

## Dependencies and Tools

### Key Dependencies
- **Vite** - Build tool and dev server
- **Rollup** - Bundler
- **ESLint** - Linting
- **TypeScript** - Type checking
- **Playwright** - Browser testing
- **Chai/Expect** - Assertions
- **Tinypool** - Worker threading
- **Tinybench** - Benchmarking

### Development Tools
- **tsx** - TypeScript execution
- **ni/nr** - Package manager abstraction
- **bumpp** - Version bumping
- **changelogithub** - Changelog generation

## Browser Testing
- Two modes: Playwright and WebDriverIO
- Separate test commands for each
- Component testing supported (Vue, React, Svelte, Lit, Marko)

## Performance Considerations
- This is a performance-critical testing framework
- Pay attention to import costs and bundle size
- Use lazy loading where appropriate
- Consider worker thread implications

## Troubleshooting

### Common Issues
- Ensure pnpm is used (not npm/yarn)
- Build before running tests
- Check Node.js version compatibility
- Playwright browsers must be installed for browser tests

### Getting Help
- Check existing issues and documentation
- Review CONTRIBUTING.md for detailed guidelines
- Follow patterns in existing code
