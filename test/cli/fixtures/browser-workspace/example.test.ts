import { expect, test } from 'vitest';
import { getWorkerState } from '../../../test-utils/runtime';

test('overriden options are found on runtime', () => {
  const config = getWorkerState().config;

  expect(config.browser.isolate).toBe(false)
  expect(config.browser.headless).toBe(true)
  expect(config.browser.name).toBe("chromium")

})
