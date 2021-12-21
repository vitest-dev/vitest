# Mocking Date

Vitest comes with [`mockdate`](https://www.npmjs.com/package/mockdate) package that lets you easily manipulate system date in your tests.

All useful methods are located on `vi` object that you can import from `vitest` package or access globally, if you have [`global`](/config/#global) config enabled.

## setSystemDate

- **Type**: `(date: string | number | Date) => void`

Sets current date to the one that was passed. All `Date` calls will return this date.

Useful if you need to test anything that depends on current date - for example `momentjs` calls inside your code.

```ts
const date = new Date(1998, 11, 19)

vi.setSystemDate(date)

expect(Date.now()).toBe(date.valueOf())
```

## getSystemDate

- **Type**: `() => string | number | Date`

Returns current date that was set using `setSystemDate`. If date is not mocked, will return real date in milliseconds.

## resetSystemDate

- **Type**: `() => void`

Restores `Date` back to its native implementation.
