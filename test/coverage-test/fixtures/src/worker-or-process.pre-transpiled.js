import { isMainThread, parentPort } from "node:worker_threads";
import { hello } from "./pre-transpiled/transpiled.js";

hello();

if (isMainThread && process.send) {
  process.send({ result: "finished" });
}
else if (parentPort) {
  parentPort.postMessage({ result: "finished" });
}
else {
  throw new Error("Where is this running?")
}
