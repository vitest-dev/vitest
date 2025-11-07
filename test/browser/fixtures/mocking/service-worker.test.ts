import { expect, test, vi } from "vitest";
import { server } from 'vitest/browser'

vi.mock("./src/actions", () => ({
  plus: vi.fn().mockReturnValue(12345),
}));


test.runIf(server.config.name === 'chromium')("Service worker does not break vi.mock", async (t) => {
  const registration = await navigator.serviceWorker.register(
    new URL("./service-worker.js", import.meta.url)
  );
  t.onTestFinished(async () => {
    await registration.unregister()
  })

  await vi.waitFor(() => expect(registration.active?.state).toBe("activated"));
  await navigator.serviceWorker.ready;
  let swResponseMessage = null;
  const messageChannel = new MessageChannel();
  messageChannel.port1.onmessage = (event) => {
    swResponseMessage = event.data;
  };
  registration.active.postMessage({ type: "PING" }, [messageChannel.port2]);
  await vi.waitFor(() => expect(swResponseMessage.type).toBe("PONG"));

  // Send a mocked API request to the service worker
  const response = await fetch("/hello");
  // Assert the service worker intercepted the request
  const responseText = await response.text();
  expect(response.status).toBe(200);
  expect(responseText).toBe("Hello from Service Worker!");

  // Send an import, which will be intercepted by the service worker
  // Verify vi.mock is still functional after mocking the network with a service worker
  const { plus } = await import("./src/actions");
  const result = plus(1, 2);
  expect(plus).toHaveBeenCalled();
  expect(result).toBe(12345);
});
