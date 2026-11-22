import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { URL } from "node:url";

const load = createRequire(import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const installedTypes = JSON.parse(readFileSync(load.resolve("@types/vscode/package.json"), "utf8"));

test("DEP-04: declared and installed VS Code types match the exact supported API minimum", () => {
  // Broad type ranges can silently expose APIs newer than the supported minimum.
  assert.match(manifest.engines.vscode, /^\^\d+\.\d+\.\d+$/);
  const minimum = manifest.engines.vscode.slice(1);
  assert.equal(manifest.devDependencies["@types/vscode"], minimum,
    "Pin VS Code types exactly to the minimum declared by engines.vscode");
  assert.equal(installedTypes.version, minimum,
    "Install the pinned VS Code types before compiling or testing");
});
