import { expect, test } from 'vitest';
import { getWorkerState } from 'vitest/src/runtime/utils.js';

test('overriden options are found on runtime', () => {
  const config = getWorkerState().config;

  expect(config.browser.isolate).toBe(false)
  expect(config.browser.name).toBe("chromium")

})
