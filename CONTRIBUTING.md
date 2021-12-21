# Vitest Contributing Guide

Hi! We are really excited that you are interested in contributing to `vitest`. Before submitting your contribution, please make sure to take a moment and read through the following guide:

## Repo Setup

The `vitest` repo is a monorepo using `pnpm` workspaces. The package manager used to install and link dependencies must be [pnpm](https://pnpm.io/).

To develop and test `vitest` package:

1. Run `pnpm i` in `vitest`'s root folder

2. Run `pnpm run dev` to build sources in watch mode

3. Run 
  - `pnpm run test` to run core tests
  - `pnpm run test:all` to run all the suite

## Debugger

### VS Code

If you want to use break point and explore code execution you can use the ["Run and debug"](https://code.visualstudio.com/docs/editor/debugging) feature from vscode.

1. Add a `debugger` statement where you want to stop the code execution.

2. Click on the "Run and Debug" icon in the activity bar of the editor.

2. Click on the "Javascript Debug Terminal" button. 

3. It will open a terminal, then type the test command: `pnpm run test`

4. The execution will stop and you'll use the [Debug toolbar](https://code.visualstudio.com/docs/editor/debugging#_debug-actions) to continue, step over, restart the process...
