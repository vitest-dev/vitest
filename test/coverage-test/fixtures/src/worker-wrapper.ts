export async function sumInBackground(a: number, b: number) {
  const worker = new Worker(new URL("./worker?with-some-query=123", import.meta.url), {
    type: "module",
  });

  const promise = new Promise<MessageEvent>(resolve => {
    worker.onmessage = resolve;
  });

  function uncovered() {
    return "This is uncovered"
  }

  worker.postMessage({ a, b });

  const result = await promise;
  covered();
  worker.terminate();

  return result.data;
}

function covered() {
  return "This is covered"
}

export function uncovered() {
  return "This is uncovered"
}
