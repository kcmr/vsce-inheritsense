import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { runWithReport } from "./extension-host/report.mjs";

function reportFile(context) {
  const root = mkdtempSync(path.join(tmpdir(), "inheritsense-report-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  return path.join(root, "results", "host.json");
}

test("extension-host report preserves progress and success after the test window exits", async (context) => {
  const file = reportFile(context);
  await runWithReport(async (report) => {
    assert.equal(JSON.parse(readFileSync(file, "utf8")).status, "running");
    report("workspace paths passed");
  }, file);
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), {
    status: "passed", messages: ["workspace paths passed"]
  });
});

test("extension-host report keeps prior progress and the original assertion error on failure", async (context) => {
  const file = reportFile(context);
  const failure = new Error("folder setting was ignored");
  await assert.rejects(runWithReport(async (report) => {
    report("workspace paths passed");
    throw failure;
  }, file), (error) => error === failure);
  const result = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(result.status, "failed");
  assert.deepEqual(result.messages, ["workspace paths passed"]);
  assert.match(result.error, /folder setting was ignored/);
});
