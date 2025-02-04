export async function calcInBackground(arg: number) {
  const worker = new Worker(new URL('./worker', import.meta.url), {
    type: 'module',
  });

  const cleanup = () => {
    worker.terminate();
  };

  let doResolve: ((arg: number) => void) | undefined = undefined;
  const resultPromise = new Promise<number>((resolve) => {
    doResolve = resolve;
  });

  worker.onmessage = (ev: MessageEvent<number>) => {
    doResolve!(ev.data);
  };

  worker.postMessage(arg);

  const result = await resultPromise;
  cleanup();
  return result;
}
