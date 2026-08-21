import { randomUUID } from "node:crypto";

export function makeId(): string {
  return randomUUID();
}
