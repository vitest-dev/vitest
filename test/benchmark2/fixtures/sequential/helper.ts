import fs from "node:fs";

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const testLogFile = new URL("./test.log", import.meta.url);

export async function appendLog(data: string) {
  await fs.promises.appendFile(testLogFile, data + "\n");
}

export const benchOptions = { time: 0, iterations: 3, warmupIterations: 0, warmupTime: 0 }
