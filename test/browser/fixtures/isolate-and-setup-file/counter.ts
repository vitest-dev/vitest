const g = globalThis as unknown as { counter: number };
export const counter = {
  get: () => g.counter,
  increment: () => g.counter++,
  reset: () => (g.counter = 0),
};
