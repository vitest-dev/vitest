self.onmessage = async () => {
  const mod = await import("./worker-dynamic-dep");
  self.postMessage(mod.default);
}
