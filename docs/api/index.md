---
outline: deep
---

# Test API Reference

Vitest provides a set of functions to define and organize your tests. This section covers the core test APIs.

## Test Functions

- [**test / it**](/api/test) - Define individual test cases with various modifiers like `.skip`, `.only`, `.concurrent`, `.each`, and more
- [**bench**](/api/test#bench) - Define benchmarks to measure performance

## Test Organization

- [**describe**](/api/describe) - Group related tests into suites with modifiers like `.skip`, `.only`, `.concurrent`, `.shuffle`, and more

## Lifecycle Hooks

- [**beforeEach / afterEach**](/api/hooks#beforeeach) - Run setup and teardown code before/after each test
- [**beforeAll / afterAll**](/api/hooks#beforeall) - Run setup and teardown code once before/after all tests in a suite
- [**onTestFinished / onTestFailed**](/api/hooks#ontestfinished) - Register callbacks during test execution
