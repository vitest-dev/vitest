self.onmessage = (ev: MessageEvent) => {
  const {a, b} = ev.data;

  if (a === 5) {
    uncovered()
    throw new Error("uncovered");
  }

  if(b === 6) {
    uncovered()
    throw new Error("uncovered");

  }

  covered();
  postMessage(a + b);
};

export function uncovered() {
  return "This is uncovered"
}

function covered() {
  return "This is covered"
}
