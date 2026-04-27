import { isMainThread, parentPort, Worker } from "node:worker_threads";
import { fork } from "node:child_process";
import { subtract } from "./math-in-js.js";

const isNested = process.env.IS_NESTED === "true";
const isMain = !isNested;

const isMainChildProcess = isMain && process.send != null;
const isMainWorkerThread = isMain && !isMainThread;

const isNestedChildProcess = isNested && process.send != null;
const isNestedWorkerThread = isNested && !isMainThread;

if(isMainChildProcess) {
  const child = fork(import.meta.filename, { env: { ...process.env, IS_NESTED: "true" } });
  const onExit = new Promise((resolve) => child.on('exit', resolve));

  const onResponse = new Promise((resolve) => child.on('message', resolve));
  const result = await onResponse;

  await onExit;
  process.send({ result });
}
else if (isNestedChildProcess) {
  process.send(subtract(10, 5));
}
else if(isMainWorkerThread) {
  const worker = new Worker(import.meta.filename, { env: { ...process.env, IS_NESTED: "true" } });
  const onExit = new Promise((resolve) => worker.on('exit', resolve));

  const onResponse = new Promise((resolve) => worker.on('message', resolve));
  const result = await onResponse;

  await onExit;
  parentPort?.postMessage({ result });
}
else if(isNestedWorkerThread) {
  parentPort.postMessage(subtract(10, 5));
}
else {
  throw new Error("Where is this running?");
}
