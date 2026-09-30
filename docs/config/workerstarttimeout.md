---
title: workerStartTimeout | Config
outline: deep
---

# workerStartTimeout <CRoot /> {#workerstarttimeout}

- **Type:** `number`
- **Default:** `60000`
- **CLI:** `--worker-start-timeout=120000`, `--workerStartTimeout=120000`

How long to wait for a test worker to start and report that it is ready, in milliseconds. The pool waits an extra 30 seconds on top of this before it gives up on the worker altogether.

Starting a worker includes setting up the test environment, so on a loaded machine or a slow CI runner a worker running `jsdom` or `happy-dom` can take longer than the default. When it does, the run fails with `Timeout waiting for worker to respond` and no test is reported as failed. Raise this value rather than a test timeout in that case: it only changes how long Vitest waits before it declares a worker dead, not how long any test may run.
