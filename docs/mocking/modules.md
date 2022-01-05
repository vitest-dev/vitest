****# Modules

Vitest provides utility functions to mock modules. You can access them on `vi` object that you can import from `vitest` package or access globally, if you have [`global`](/config/#global) config enabled.

## Configuration
All useful methods are located on `vi` object that you can import from `vitest` package or access globally, if you have [`global`](/config/#global) config enabled.

## Example


## More

## Automocking algorithm

If your code is importing mocked module, but there are no `__mocks__` file for this module or a `factory`, Vitest will mock the module itself by invoking it and mocking every export.

* All arrays will be emptied
* All primitives and collections will stay the same
* All objects will be deeply cloned
* All instances of classes and their prototypes will be deeply cloned
