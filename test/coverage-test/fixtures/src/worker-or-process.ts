import { isMainThread, parentPort } from "node:worker_threads";
import { subtract } from "./math.ts";

interface Options {
  left: number;
  right: number;
}

/**
 * Comment that adds padding
 */
function execute(options: Options) {
  return subtract(options.left, options.right);
}

const result = execute({ left: 10, right: 5 });

if (isMainThread && process.send) {
  // Comment
  interface Padding {
    left: number;
    right: number;
  }
  // Comment
  process.send({ result });
  interface Padding2 {
    left: number;
    right: number;
  }
  // Comment
}
else if (parentPort) {
  // Comment
  // Comment
  // Comment
  // Comment
  parentPort.postMessage({ result });
}
else {
  // Comment
  type A = "B"
  type B = "C"
  // Comment
  throw new Error("Where is this running?" as unknown as A | B)
}
