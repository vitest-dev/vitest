export type TestSourcemap = {
  noop: true,
}

export function setup() {
  // test sourcemap
  void new Promise((_, reject) => reject(new Error('intentional unhandled rejection')))
}
