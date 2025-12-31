import fs from "node:fs";

const SLEEP_BENCH_MS = Number(process.env["SLEEP_BENCH_MS"] || 10);
const BENCH_ITERATIONS = Number(process.env["BENCH_ITERATIONS"] || 3);

export const sleepBench = () => new Promise(resolve => setTimeout(resolve, SLEEP_BENCH_MS))

export const testLogFile = new URL("./test.log", import.meta.url);

export async function appendLog(data: string) {
  await fs.promises.appendFile(testLogFile, data + "\n");
}

export const benchOptions = {
  time: 0,
  iterations: BENCH_ITERATIONS,
  warmupIterations: 0,
  warmupTime: 0,
}
