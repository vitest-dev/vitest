---
title: Reporters | Guide
---

# Reporters

Vitest provides several built-in reporters to display test output in different formats, as well as the ability to use custom reporters. You can select different reporters either by using the `--reporter` command line option, or by including a `reporters` property in your [configuration file](https://vitest.dev/config/#reporters). If no reporter is specified, Vitest will use the `default` reporter as described below.

Using reporters via command line:

```bash
npx vitest --reporter=verbose
```

Using reporters via `vite.config.ts`:

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    reporters: ['verbose']
  }
});
```

## Reporter Output

By default, Vitest's reporters will print their output to the terminal. When using the `json`, `html`, or `junit` reporters, you can instead write your tests' output to a file by including an `outputFile` [configuration option](https://vitest.dev/config/#outputfile) either in your Vite configuration file or via CLI.

Command line:
```bash
npx vitest --reporter=json --outputFile=./test-output.json
```

`vite.config.ts`
```ts
export default defineConfig({
  test: {
    reporters: ['json'],
    outputFile: './test-output.json'
  }
});
```

## Combining Reporters

You can use multiple reporters simultaneously to print your tests results in different formats. For example:

```bash
npx vitest --reporter=json --reporter=default
```

```ts
export default defineConfig({
  test: {
    reporters: ['json', 'default'],
    outputFile: './test-output.json'
  }
});
```

The above example will both print the test results to the terminal in the default style, and write them as JSON to the designated output file.

## Built-in Reporters

### Default reporter

By default (i.e. if no reporter is specified), Vitest will display results for each test suite hierarchically as they run, and then collapse after a suite passes. When all tests have finished running, the final terminal output will display a summary of results and details of any failed tests.

```bash
npx vitest --reporter=default
```

```ts
export default defineConfig({
  test: {
    reporters: ['default']
  },
});
```

### Basic reporter

The `basic` reporter displays the tests files that have run and a summary of results after the entire suite has finished running. Individual tests are not included in the report unless they fail. 

```bash
npx vitest --reporter=basic
```

```ts
export default defineConfig({
  test: {
    reporters: ['basic']
  },
});
```

### Verbose reporter

Follows the same hierarchical structure as the `default` reporter, but does not collapse sub-trees for passed test suites. The final terminal output displays all tests that have run, including those that have passed.

```bash
npx vitest --reporter=verbose
```

```ts
export default defineConfig({
  test: {
    reporters: ['verbose']
  },
});
```

### Dot reporter

Prints a single dot for each completed test to provide minimal output while still showing all tests that have run. Details are only provided for failed tests, along with the `basic` reporter summary for the suite.

```bash
npx vitest --reporter=dot
```

```ts
export default defineConfig({
  test: {
    reporters: ['dot']
  },
});
```

### JUnit reporter

Outputs a report of the test results in JUnit XML format. Can either be printed to the terminal or written to an XML file using the [`outputFile`](##Reporter-Output) configuration option. 

```bash
npx vitest --reporter=junit
```

```ts
export default defineConfig({
  test: {
    reporters: ['junit']
  },
});
```

The outputted XML contains nested `testsuites` and `testcase` tags. You can use the environment variables `VITEST_JUNIT_SUITE_NAME` and `VITEST_JUNIT_CLASSNAME` to configure their `name` and `classname` attributes, respectively.

### JSON reporter

Outputs a report of the test results in JSON format. Can either be printed to the terminal or written to a file using the [`outputFile`](##Reporter-Output) configuration option. 

```bash
npx vitest --reporter=json
```

```ts
export default defineConfig({
  test: {
    reporters: ['json']
  },
});
```

### HTML reporter

Generates an HTML file to view tests results through an interactive GUI. After the file has been generated, Vitest will keep a local development server running and provide a link to view the report in a browser.

Output file can be specified using the [`outputFile`](##Reporter-Output) configuration option. If no `outputFile` option is provided, a new HTML file will be created. 

```bash
npx vitest --reporter=html
```

```ts
export default defineConfig({
  test: {
    reporters: ['html']
  },
});
```

### TAP reporter

Outputs a report following [Test Anything Protocol](https://testanything.org/) (TAP). 

```bash
npx vitest --reporter=tap
```

```ts
export default defineConfig({
  test: {
    reporters: ['tap']
  },
});
```

### TAP flat reporter

Outputs a TAP flat report. Like the `tap` reporter, test results are formatted to follow TAP standards, but test suites are formatted as a flat list rather than a nested hierarchy.

```bash
npx vitest --reporter=tap-flat
```

```ts
export default defineConfig({
  test: {
    reporters: ['tap-flat']
  },
});
```

### Hanging process reporter

Displays a list of hanging processes, if any are preventing Vitest from exiting safely. The `hanging-process` reporter does not itself display test results, but can be used in conjunction with another reporter to monitor processes while tests run. Using this reporter can be resource-intensive, so should generally be reserved for debugging purposes in situations where Vitest consistently cannot exit the process.

```bash
npx vitest --reporter=hanging-process
```

```ts
export default defineConfig({
  test: {
    reporters: ['hanging-process']
  },
});
```

## Custom reporters

You can define your own custom reporters and use them by specifying their file path:

```bash
npx vitest --reporter=./path/to/reporter.ts
```

Custom reporters should implement the [Reporter interface](https://github.com/vitest-dev/vitest/blob/main/packages/vitest/src/types/reporter.ts). 
