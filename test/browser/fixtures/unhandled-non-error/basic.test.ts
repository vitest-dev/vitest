import { test } from "vitest";

test("ResizeObserver error", async () => {
	const divElem = document.createElement("div");
	divElem.style.width = "100px";
	divElem.style.height = "100px";
	document.body.appendChild(divElem);

	const resizeObserver = new ResizeObserver((entries) => {
		for (const entry of entries) {
			(entry.target as HTMLElement).style.width =
				`${entry.contentBoxSize[0].inlineSize + 10}px`;
		}
	});
	const promise = Promise.withResolvers();
	window.addEventListener("error", (event) => {
		if (event.message.includes("ResizeObserver loop")) {
			promise.resolve(null);
		}
	});
	resizeObserver.observe(divElem);
	await promise.promise;
	resizeObserver.unobserve(divElem);
});
