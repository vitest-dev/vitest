self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("/hello")) {
    event.respondWith(
      new Response("Hello from Service Worker!", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      })
    );
  } else {
    // Pass through other requests
    event.respondWith(fetch(event.request));
  }
});

// Handle messages from the test
self.addEventListener("message", (event) => {
  if (event.data.type === "PING") {
    event.ports[0].postMessage({ type: "PONG" });
  }
});
