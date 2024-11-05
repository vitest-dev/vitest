export function setup() {
  void new Promise((_, reject) => reject(new Error('intentional unhandled rejection')))
}
