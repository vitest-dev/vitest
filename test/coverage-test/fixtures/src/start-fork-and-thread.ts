import { fork } from 'node:child_process';
import { resolve } from 'node:path';
import { Worker } from 'node:worker_threads';

const filename = resolve(import.meta.dirname, 'worker-or-process.ts');

export async function runFork() {
  const child = fork(filename);
  const onExit = new Promise((resolve) => child.on('exit', resolve));

  const onResponse = new Promise<{ result: number }>((resolve) => child.on('message', resolve));
  const response = await onResponse;

  await onExit;

  return response.result;
}

export async function runThread() {
  const worker = new Worker(filename, { env: process.env });
  const onExit = new Promise((resolve) => worker.on('exit', resolve));

  const onResponse = new Promise<{ result: number }>((resolve) => worker.on('message', resolve));
  const response = await onResponse;

  await onExit;

  return response.result;
}