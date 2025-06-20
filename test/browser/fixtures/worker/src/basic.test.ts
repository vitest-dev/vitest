import { expect, test } from 'vitest'

test('worker dynamic dep', async () => {
  const worker = new Worker(new URL('./worker', import.meta.url), { type: 'module' });
  const data = await new Promise((resolve, reject) => {
    worker.addEventListener("message", (e) => resolve(e.data))
    worker.addEventListener("messageerror", (e) => reject(e))
    worker.postMessage("ping");
  });
  expect(data).toMatchInlineSnapshot(`"worker-dynamic-dep-ok"`);
})
