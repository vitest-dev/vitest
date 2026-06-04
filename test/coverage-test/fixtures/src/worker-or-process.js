import { isMainThread, parentPort } from "node:worker_threads";
import { subtract } from "./math-in-js.js";

/**
 * Comment that adds padding
 */
function execute(options) {
  return subtract(options.left, options.right);
}

const result = execute({ left: 10, right: 5 });

if (isMainThread && process.send) {
  // Comment
  // Comment
  process.send({ result });
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
  // Comment
  throw new Error("Where is this running?")
}
