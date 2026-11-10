---
title: seed | Config
outline: deep
---

# seed <CRoot /> <Experimental /> <Version type="experimental">5.2.0</Version> {#seed}

- **Type:** `number | 'random'`
- **Default:** `0`, or a random seed if files or tests are shuffled
- **CLI:** `--seed <seed>`

The seed for the order of shuffled files and tests (see [`sequence.shuffle`](/config/sequence#sequence-shuffle)), and for [`context.random`](/guide/test-context#random).

Vitest derives the seed of each test from this seed, the project name, the file path and the full name of the test. A test keeps its random values when you filter or shuffle tests, or add other tests to the file.

Each project gets different values. In browser mode, each [browser instance](/config/browser/instances) is a separate project, so a test gets different values in each browser.

Suites shuffled with [`describe.shuffle`](/api/describe#describe-shuffle) also use this seed. If the config does not shuffle tests, their order is the same on every run until you set another seed.

The order of shuffled tests in a suite also has its own seed, from this seed, the project name, the file path and the full name of the suite. A suite keeps its order when you add or remove other suites.

If tests are not shuffled, the default seed is `0`, so `context.random` returns the same values on every run. Set another seed to test other values:

```sh
vitest --seed 42
```

Use `random` to generate a new seed. If tests are shuffled and you do not set a seed, Vitest also generates a new seed on every run. Vitest prints the seed at the start of the run, so you can repeat the run with the same order and the same values:

```sh
$ vitest --seed random

 RUN  v5.2.0 /home/user/project
      Running tests with seed "158412337095872"
```

Vitest throws an error if the value is not a number or `'random'`.

::: tip
[`sequence.seed`](/config/sequence#sequence-seed) is a deprecated alias of this option. If both are set, `seed` wins.
:::
