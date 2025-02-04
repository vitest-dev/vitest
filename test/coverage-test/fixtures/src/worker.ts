self.onmessage = (ev: MessageEvent<number>) => {
  const start = performance.now();
  let data = ev.data;
  if (data === 5) {
    uncovered()
    throw new Error("uncovered");
  }

  if(data === 6) {
    uncovered()
    throw new Error("uncovered");

  }

  while (data > 9) {
    data -= 1;
  }

  const result = doCalc(data);
  postMessage(result);
};

function uncovered() {
  return "This is uncovered"
}

function doCalc(arg: number) {
  return arg * 2;
}