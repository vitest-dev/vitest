import { page, userEvent, server } from "@vitest/browser/context";
import { expect, test } from "vitest";

test("drag and drop over large viewport", async () => {
  // put boxes horizontally [1] [2] ... [30]
  // then drag-and-drop from [1] to [30]

  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display: flex; width: 3000px;";
  document.body.appendChild(wrapper);

  const events: { i: number; type: string }[] = [];

  for (let i = 1; i <= 30; i++) {
    const el = document.createElement("div");
    el.textContent = `[${i}]`;
    el.style.cssText = `
      flex: none;
      width: 100px;
      height: 100px;
      border: 1px solid black;
      box-sizing: border-box;
      display: flex;
      justify-content: center;
      align-items: center;
    `;
    el.draggable = true;
    wrapper.append(el);

    el.addEventListener("dragstart", (ev) => {
      ev.dataTransfer.effectAllowed = "move";
      events.push({ type: "dragstart", i });
    });
    el.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "move";
      events.push({ type: "dragover", i });
    });
    el.addEventListener("drop", (ev) => {
      ev.preventDefault();
      events.push({ type: "drop", i });
    });
  }

  // drag and drop only works reliably on playwright
  if (server.provider !== 'playwright') {
    return
  }

  await userEvent.dragAndDrop(page.getByText("[1]"), page.getByText("[30]"));

  expect(events).toMatchObject(
    expect.arrayContaining([
      { type: "dragstart", i: 1 },
      { type: "drop", i: 30 },
    ]),
  );
});
