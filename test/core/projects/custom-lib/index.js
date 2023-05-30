export default function () {
  // module doesn't exist in Node.js ESM, but exists in vite-node
  return typeof module
}
