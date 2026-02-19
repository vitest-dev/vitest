import { createRequire } from "node:module";
import { readdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "pathe";
import { afterEach, describe, expect, test } from "vitest";
import { instances, provider, runBrowserTests } from "./utils";
import { buildTestProjectTree } from "../../test-utils";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";

type TraceBeforeEvent = {
  type: "before";
  callId: string;
  class: string;
  method: string;
  title?: string;
  stack?: { file: string }[];
};

type TraceAfterEvent = {
  type: "after";
  callId: string;
};

type TraceEvent = TraceBeforeEvent | TraceAfterEvent | { type: string };

type ZipFileType = {
  entries: () => Promise<string[]>;
  read: (entryPath: string) => Promise<Buffer>;
  close: () => void;
};

const require = createRequire(import.meta.url);
const playwrightEntry = require.resolve("playwright");
const zipFileEntry = resolve(
  dirname(playwrightEntry),
  "../playwright-core/lib/server/utils/zipFile.js",
);
const { ZipFile } = require(zipFileEntry) as { ZipFile: new (fileName: string) => ZipFileType };

const tracesFolder = resolve(import.meta.dirname, "../fixtures/trace-mark/__traces__");
const basicTestTracesFolder = resolve(tracesFolder, "basic.test.ts");

describe.runIf(provider.name === "playwright")("playwright trace marks", () => {
  afterEach(() => {
    rmSync(tracesFolder, { recursive: true, force: true });
  });

  test("vitest mark is present in zipped trace events", async () => {
    const { results } = await runBrowserTests({
      root: "./fixtures/trace-mark",
      browser: {
        trace: {
          mode: "on",
          screenshots: false, // makes it lighter
        },
      },
    });
    const projectTree = buildTestProjectTree(results, (testCase) => {
      const result = testCase.result();
      return result.state === "failed"
        ? result.errors.map((e) => stripVTControlCharacters(e.message))
        : result.state;
    });
    expect(Object.keys(projectTree).sort()).toEqual(instances.map((i) => i.browser).sort());

    for (const [_name, tree] of Object.entries(projectTree)) {
      expect.soft(tree).toMatchInlineSnapshot(`
        {
          "basic.test.ts": {
            "expect.element fail": [
              "expect(element).toHaveTextContent()

        Expected element to have text content:
          World
        Received:
          Hello",
            ],
            "expect.element pass": "passed",
            "failure": [
              "Test failure",
            ],
            "locator.mark": "passed",
            "page.mark": "passed",
          },
        }
      `);

      // TODO: probe zip here
    }

    // expect(stderr).toBe('')
    // expect(readdirSync(tracesFolder)).toEqual(['basic.test.ts'])

    // const traceFiles = readdirSync(basicTestTracesFolder).sort()
    // expect(traceFiles).toHaveLength(3)
    // expect(traceFiles.every(file => file.endsWith('.trace.zip'))).toBe(true)

    // for (const traceFile of traceFiles) {
    //   const zipPath = resolve(basicTestTracesFolder, traceFile)
    //   const { entries, events } = await readTraceZip(zipPath)

    //   expect(entries).toContain('trace.trace')
    //   expect(entries).toContain('trace.network')
    //   expect(entries.some(name => name.startsWith('resources/'))).toBe(true)

    //   const renderMarker = events.find((event): event is TraceBeforeEvent => {
    //     return event.type === 'before'
    //       && event.class === 'Tracing'
    //       && event.title === 'render'
    //   })
    //   expect(renderMarker).toBeDefined()
    //   expect(['tracingGroup', 'tracingMark']).toContain(renderMarker!.method)

    //   const renderMarkerEnd = events.find((event): event is TraceAfterEvent => {
    //     return event.type === 'after'
    //       && event.callId === renderMarker!.callId
    //   })
    //   expect(renderMarkerEnd).toBeDefined()

    //   const stackFile = renderMarker!.stack?.[0]?.file.replaceAll('\\', '/')
    //   expect(stackFile).toContain('/trace-mark/basic.test.ts')

    //   const expectElementMarker = events.find((event): event is TraceBeforeEvent => {
    //     return event.type === 'before'
    //       && event.class === 'Tracing'
    //       && event.title?.startsWith('expect.element().toHaveTextContent')
    //   })
    //   expect(expectElementMarker).toBeDefined()
    // }
  });
});

async function readTraceZip(zipPath: string): Promise<{ entries: string[]; events: TraceEvent[] }> {
  const zipFile = new ZipFile(zipPath);
  try {
    const entries = await zipFile.entries();
    const traceText = (await zipFile.read("trace.trace")).toString("utf-8");
    const events = traceText
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        return JSON.parse(line) as TraceEvent;
      });
    return { entries, events };
  } finally {
    zipFile.close();
  }
}
