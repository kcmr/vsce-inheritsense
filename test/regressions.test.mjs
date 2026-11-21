import assert from "node:assert/strict";
import { test } from "node:test";
import { extractFileSymbols } from "../dist/parser/symbols.js";
import { resolveMemberOrigins, resolveInheritedMemberCatalog } from "../dist/resolver/memberResolver.js";
import { documentInput, moduleGraph } from "./helpers.mjs";

// Execute the intended assertions, but report known failures as TODO rather than
// passing coverage. Remove TODO when the corresponding fix is implemented.
test("FIX-01: constructor discovery respects nested function/class scopes and lexical arrows", {
  todo: "FIX-01: assignment traversal does not delimit this scopes"
}, () => {
  const source = `class Example {
    constructor() {
      this.own = true;
      const arrow = () => { this.lexical = true; };
      function unrelated() { this.foreignFunction = true; }
      class Nested { constructor() { this.foreignClass = true; } }
    }
  }`;
  const members = extractFileSymbols(source, "example.js").classes[0].members;
  assert.deepEqual(members.map((member) => member.name).sort(), ["lexical", "own"]);
});

for (const mode of ["lookup", "catalog"]) {
  test(`FIX-02: ${mode} traverses all local ancestors`, {
    todo: "FIX-02: local-class traversal stops after the direct parent"
  }, (context) => {
    const file = moduleGraph(context, {
      "subject.js": `class Root { execute() {} }
class Middle extends Root {}
class Subject extends Middle { inspect() {} }`
    });
    const input = documentInput(file("subject.js"), "inspect()");
    const origins = mode === "lookup"
      ? resolveMemberOrigins({ ...input, memberName: "execute" })
      : resolveInheritedMemberCatalog(input);
    assert.equal(origins.length, 1);
    assert.equal(origins[0].ownerName, "Root");
    assert.equal(origins[0].memberName, "execute");
  });
}

for (const mode of ["import", "reexport"]) {
  test(`FIX-03: resolves a renamed ${mode} to its exported identity`, {
    todo: "FIX-03: import metadata loses the original exported name"
  }, (context) => {
    const file = moduleGraph(context, {
      "root.js": "export class Root { execute() {} }",
      "index.js": "export { Root as Renamed } from './root.js';",
      "subject.js": mode === "import"
        ? "import { Root as Renamed } from './root.js'; class Subject extends Renamed { inspect() {} }"
        : "import { Renamed } from './index.js'; class Subject extends Renamed { inspect() {} }"
    });
    const input = documentInput(file("subject.js"), "inspect()");
    const origins = resolveMemberOrigins({ ...input, memberName: "execute" });
    assert.equal(origins.length, 1);
    assert.equal(origins[0].ownerName, "Root");
    assert.equal(origins[0].filePath, file("root.js"));
  });
}
