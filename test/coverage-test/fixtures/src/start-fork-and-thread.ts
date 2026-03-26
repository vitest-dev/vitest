import { fork } from 'node:child_process';
import { resolve } from 'node:path';
import { Worker } from 'node:worker_threads';

export async function runFork(filename: string): Promise<any> {
  const child = fork(resolve(import.meta.dirname, filename));
  const onExit = new Promise((resolve) => child.on('exit', resolve));

  const onResponse = new Promise((resolve) => child.on('message', resolve));
  const response = await onResponse;

  await onExit;

  return response;
}

export async function runThread(filename: string): Promise<any> {
  const worker = new Worker(resolve(import.meta.dirname, filename), { env: process.env });
  const onExit = new Promise((resolve) => worker.on('exit', resolve));

  const onResponse = new Promise((resolve) => worker.on('message', resolve));
  const response = await onResponse;

  await onExit;

  return response;
}