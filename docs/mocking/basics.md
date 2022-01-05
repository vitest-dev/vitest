# Basics
When writing tests it's only a matter of time before you need to create 'fake' version of an internal- or external service. This is commonly referred to as **mocking**. Vitest provides utility functions to help you out in the form it's `vi` helper. You can `import { vi } from 'vitest'` or accessed globally (when global configuration is enabled).

Following are some example implementations of common test cases that require mocking. If you want to dive in head first visit the [vi API section](https://vitest.dev/guide/api.html#vi) otherwise keep reading to take it step by step.

# Dates

Vitest comes with [`mockdate`](https://www.npmjs.com/package/mockdate) package that lets you easily manipulate system date in your tests.

## Configuration
All useful methods are located on `vi` object that you can import from `vitest` package or access globally, if you have [`global`](/config/#global) config enabled.

## Example


## More
