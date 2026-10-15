import { setTimeout } from "node:timers/promises";

const delay = parseInt(process.env.DELAY ?? "100", 10);

if (delay > 0) {
  await setTimeout(delay);
}

export const response = { ok: true };
