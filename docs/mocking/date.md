# Dates

Vitest comes with [`mockdate`](https://www.npmjs.com/package/mockdate) package that lets you easily manipulate system date in your tests.

All useful methods are located on `vi` object that you can import from `vitest` package or access globally, if you have [`global`](/config/#global) config enabled.

## mockCurrentDate

- **Type**: `(date: string | number | Date) => void`

Sets current date to the one that was passed. All `Date` calls will return this date.

Useful if you need to test anything that depends on the current date - for example [luxon](https://github.com/moment/luxon/) calls inside your code.

```ts
const date = new Date(1998, 11, 19)

vi.mockCurrentDate(date)

expect(Date.now()).toBe(date.valueOf())
```

## getMockedDate

- **Type**: `() => string | number | Date`

Returns mocked current date that was set using `mockCurrentDate`. If date is not mocked, will return `null`.

## restoreCurrentDate

- **Type**: `() => void`

Restores `Date` back to its native implementation.
