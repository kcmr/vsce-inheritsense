import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveImportPath } from "../dist/resolver/importResolver.js";
import { moduleGraph } from "./helpers.mjs";

for (const extension of ["js", "mjs", "cjs"]) {
  test(`resolves explicit, extensionless, and directory-index .${extension} imports`, (context) => {
    const file = moduleGraph(context, {
      "subject.js": "",
      [`module.${extension}`]: "export const value = 1;",
      [`folder/index.${extension}`]: "export const value = 2;"
    });
    for (const source of [`./module.${extension}`, "./module"]) {
      assert.equal(resolveImportPath(file("subject.js"), source), file(`module.${extension}`));
    }
    assert.equal(resolveImportPath(file("subject.js"), "./folder"), file(`folder/index.${extension}`));
  });
}

test("resolves package main entries relative to the importing file", (context) => {
  const file = moduleGraph(context, {
    "subject.js": "",
    "node_modules/example-package/package.json": JSON.stringify({ main: "lib/entry.js" }),
    "node_modules/example-package/lib/entry.js": "module.exports = {};"
  });
  assert.equal(resolveImportPath(file("subject.js"), "example-package"), file("node_modules/example-package/lib/entry.js"));
});

test("returns null for nonexistent files, empty directories, and packages", (context) => {
  const file = moduleGraph(context, { "subject.js": "", "empty/placeholder.txt": "" });
  for (const source of ["./missing", "./empty", "missing-example-package"]) {
    assert.equal(resolveImportPath(file("subject.js"), source), null);
  }
});
