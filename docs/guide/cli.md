# Command Line Interface

## Commands

### `vitest watch`

  Run all test suites but watch for changes and rerun tests when they change. Same as calling `vitest` without a command. In CI environments this command will fallback to `vitest run`

### `vitest run`

  Perform a single run without watch mode.

### `vitest dev`

  Run vitest in development mode.

### `vitest related`

  Run only tests that cover a list of source files. Works with static lazy imports, but not the dynamic ones. All files should be relative to root folder.

  Useful to run with [`lint-staged`](https://github.com/okonet/lint-staged) or with your CI setup.

  ```bash
  vitest related /src/index.ts /src/hello-world.js
  ```

## Options

| Options       |               |
| ------------- | ------------- |
| `-v, --version` | Display version number |
| `-r, --root <path>` | Define the project root |
| `-c, --config <path>` | Path to config file |
| `-u, --update` | Update snapshots |
| `-w, --watch` | Smart & instant watch mode |
| `-t, --testNamePattern <pattern>` | Run tests with full names matching the pattern |
| `--dir <path>`| Base directory to scan for the test files |
| `--ui` | Enable UI |
| `--open` | Open the UI automatically if enabled (default: `true`) |
| `--api [api]` | Serve API, available options: `--api.port <port>`, `--api.host [host]` and `--api.strictPort` |
| `--threads` | Enable Threads (default: `true`) |
| `--silent` | Silent console output from tests |
| `--isolate` | Isolate environment for each test file (default: `true`) |
| `--reporter <name>` | Select reporter: `default`, `verbose`, `dot`, `junit`, `json`, or a path to a custom reporter |
| `--outputFile <filename/-s>` | Write test results to a file when the `--reporter=json` or `--reporter=junit` option is also specified <br /> Via [cac's dot notation] you can specify individual outputs for multiple reporters |
| `--coverage` | Use c8 for coverage |
| `--run` | Do not watch |
| `--mode` | Override Vite mode (default: `test`) |
| `--mode <name>` | Override Vite mode (default: `test`) |
| `--globals` | Inject APIs globally |
| `--dom` | Mock browser api with happy-dom |
| `--environment <env>` | Runner environment (default: `node`) |
| `--passWithNoTests` | Pass when no tests found |
| `--allowOnly` | Allow tests and suites that are marked as `only` (default: false in CI, true otherwise) |
| `--changed [since]` | Run tests that are affected by the changed files (default: false). See [docs](#changed)
| `-h, --help` | Display available CLI options |

### changed

- **Type**: `boolean | string`
- **Default**: false

Run tests only against changed files. If no value is provided, it will run tests against uncomitted changes (includes staged and unstaged).

To run tests against changes made in last commit, you can use `--changed HEAD~1`. You can also pass commit hash or branch name.
