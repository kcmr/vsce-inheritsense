import assert from "node:assert/strict";
import { test } from "node:test";
import { extractFileSymbols } from "../dist/parser/symbols.js";
import { resolveMemberOrigins, resolveInheritedMemberCatalog } from "../dist/resolver/memberResolver.js";
import { documentInput, moduleGraph } from "./helpers.mjs";

test("FIX-01: constructor discovery respects nested function/class scopes and lexical arrows", () => {
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

for (const includeMethodAssignedFields of [false, true]) {
  test(`FIX-01: assignment scopes in ${includeMethodAssignedFields ? "permissive" : "strict"} mode`, () => {
    const source = `class Example {
      ${includeMethodAssignedFields ? "configure" : "constructor"}() {
        this.own = true;
        const arrow = (value = (this.arrowDefault = true)) => () => { this.lexical = value; };
        function unrelated(value = (this.foreignDefault = true)) {
          const nestedArrow = () => { this.foreignArrow = value; };
        }
        const expression = function () { this.foreignExpression = true; };
        const object = {
          [this.objectKey = "method"]() { this.foreignMethod = true; },
          get value() { this.foreignGetter = true; },
          set value(next) { this.foreignSetter = next; },
          arrow: () => { this.objectArrow = true; }
        };
        class Nested extends (this.heritage = Parent) {
          [this.classKey = "method"]() { this.foreignClass = true; }
          static [this.staticKey = "field"] = (this.foreignStatic = true);
          field = (() => { this.foreignInitializer = true; })();
          static { this.foreignBlock = true; }
        }
        const ClassExpression = class { constructor() { this.foreignClassExpression = true; } };
      }
    }`;
    const { members } = extractFileSymbols(source, "example.js", { includeMethodAssignedFields }).classes[0];
    assert.deepEqual(members.filter((member) => member.kind === "field").map(({ name }) => name).sort(), [
      "arrowDefault", "classKey", "heritage", "lexical", "objectArrow", "objectKey", "own", "staticKey"
    ]);
    if (includeMethodAssignedFields) {
      const strictMembers = extractFileSymbols(source, "example.js").classes[0].members;
      assert.deepEqual(strictMembers.map(({ name }) => name), ["configure"]);
    }
  });
}

test("FIX-01: injector calls keep lexical this and exclude foreign scopes in lookup and catalog", (context) => {
  const file = moduleGraph(context, {
    "subject.js": `function own(target) { target.injected = true; }
function lexical(target) { target.arrowInjected = true; }
function key(target) { target.keyInjected = true; }
function foreign(target) { target.foreignInjected = true; }
class Base {
  constructor() {
    own(this);
    const arrow = () => { lexical(this); };
    function unrelated() { foreign(this); }
    const expression = function () { foreign(this); };
    const object = { [key(this)]() { foreign(this); } };
    class Nested { constructor() { foreign(this); } }
  }
}
class Subject extends Base { inspect() {} }`
  });
  const input = documentInput(file("subject.js"), "inspect()");
  const { classes } = extractFileSymbols(input.sourceCode, input.filePath);
  assert.deepEqual(classes[0].injectorCalls, [
    { localName: "own" }, { localName: "lexical" }, { localName: "key" }
  ]);
  const catalog = resolveInheritedMemberCatalog(input);
  assert.deepEqual(catalog.map(({ memberName }) => memberName).sort(), ["arrowInjected", "injected", "keyInjected"]);
  for (const memberName of ["injected", "arrowInjected", "keyInjected", "foreignInjected"]) {
    assert.deepEqual(resolveMemberOrigins({ ...input, memberName }), catalog.filter((origin) => origin.memberName === memberName));
  }
});

// Execute the intended assertions, but report known failures as TODO rather than
// passing coverage. Remove TODO when the corresponding fix is implemented.
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
