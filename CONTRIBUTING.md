# Vitest Contributing Guide

Hi! We are really excited that you are interested in contributing to `vitest`. Before submitting your contribution, please make sure to take a moment and read through the following guide:

## Right access (temporary)

Please, arise your hand with a comment in this [issue](https://github.com/antfu-sponsors/vitest/issues/24) to get the permission.

## Repo Setup

The `vitest` repo is a monorepo using `pnpm` workspaces. The package manager used to install and link dependencies must be [pnpm](https://pnpm.io/).

To develop and test `vitest` package:

1. Run `pnpm i` in `vitest`'s root folder

2. Run `pnpm run dev` to build sources in watch mode

3. Run 
  - `pnpm run test` to run core tests
  - `pnpm run test:all` to run all the suite