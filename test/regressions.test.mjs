import assert from "node:assert/strict";
import { test } from "node:test";
import { extractFileSymbols } from "../dist/parser/symbols.js";
import { resolveMemberOrigins, resolveInheritedMemberCatalog } from "../dist/resolver/memberResolver.js";
import { assertOrigin, documentInput, moduleGraph } from "./helpers.mjs";

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

for (const mode of ["lookup", "catalog"]) {
  test(`FIX-02: ${mode} traverses all local ancestors`, (context) => {
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
    assertOrigin(origins[0], {
      memberName: "execute", kind: "method", ownerName: "Root",
      filePath: file("subject.js"), marker: "execute()", confidence: "high"
    });
  });
}

for (const imported of [false, true]) {
  test(`FIX-02: traverses local providers ${imported ? "inside an imported module" : "before an imported ancestor"}`, (context) => {
    const file = moduleGraph(context, {
      "root.js": "export class Root { execute() {} }",
      "base.js": `import { Root } from './root.js';
class Middle extends Root {}
export const Factory = parent => class extends Middle { factoryMethod() {} };`,
      "subject.js": imported
        ? `import { Factory } from './base.js';
class Subject extends Factory(Object) { inspect() {} }`
        : `import { Root } from './root.js';
class Middle extends Root {}
const Factory = parent => class extends Middle { factoryMethod() {} };
class Subject extends Factory(Object) { inspect() {} }`
    });
    const input = documentInput(file("subject.js"), "inspect()");
    const catalog = resolveInheritedMemberCatalog(input);
    for (const [memberName, ownerName, originFile, marker] of [
      ["execute", "Root", "root.js", "execute()"],
      ["factoryMethod", "Factory", imported ? "base.js" : "subject.js", "factoryMethod()"]
    ]) {
      const origins = resolveMemberOrigins({ ...input, memberName });
      assert.equal(origins.length, 1);
      assertOrigin(origins[0], { memberName, kind: "method", ownerName, filePath: file(originFile), marker, confidence: "high" });
      assert.deepEqual(catalog.filter((origin) => origin.memberName === memberName), origins);
    }
  });
}

test("FIX-02: local recursion uses the current document source before saving", (context) => {
  const file = moduleGraph(context, {
    "subject.js": `class Root { savedMember() {} }
class Middle extends Root {}
class Subject extends Middle { inspect() {} }`
  });
  const saved = documentInput(file("subject.js"), "inspect()");
  const input = { ...saved, sourceCode: saved.sourceCode.replace("savedMember", "editedMember") };
  const catalog = resolveInheritedMemberCatalog(input);
  const origins = resolveMemberOrigins({ ...input, memberName: "editedMember" });
  assert.equal(origins.length, 1);
  assert.equal(origins[0].ownerName, "Root");
  assert.equal(origins[0].line, 1);
  assert.equal(origins[0].filePath, input.filePath);
  assert.deepEqual(catalog, origins);
  assert.deepEqual(resolveMemberOrigins({ ...input, memberName: "savedMember" }), []);
});

test("FIX-02: nearest declarations and injectors precede ancestor origins", (context) => {
  const file = moduleGraph(context, {
    "subject.js": `function install(target) { target.injected = true; target.execute = () => {}; }
class Root { execute() {} injected() {} inherited() {} }
class Middle extends Root { constructor() { install(this); } execute() {} }
class Subject extends Middle { inspect() {} }`
  });
  const input = documentInput(file("subject.js"), "inspect()");
  const catalog = resolveInheritedMemberCatalog(input);
  for (const [memberName, ownerName, kind] of [["execute", "Middle", "method"], ["injected", "install", "field"], ["inherited", "Root", "method"]]) {
    const origins = resolveMemberOrigins({ ...input, memberName });
    assert.equal(origins.length, 1);
    assert.equal(origins[0].ownerName, ownerName);
    assert.equal(origins[0].kind, kind);
    assert.deepEqual(catalog.find((origin) => origin.memberName === memberName), origins[0]);
  }
  assert.deepEqual(catalog.filter((origin) => origin.memberName === "execute").map(({ ownerName }) => ownerName), ["Middle", "install", "Root"]);
});

test("FIX-02: deep ancestors preserve injectors and strict/permissive assignment discovery", (context) => {
  const file = moduleGraph(context, {
    "install.js": "export function install(target) { target.injected = true; }",
    "subject.js": `import { install } from './install.js';
class Root {
  constructor() { this.own = true; install(this); }
  configure() { this.dynamic = true; }
}
class Middle extends Root {}
class Subject extends Middle { inspect() {} }`
  });
  for (const includeMethodAssignedFields of [false, true]) {
    const input = { ...documentInput(file("subject.js"), "inspect()"), includeMethodAssignedFields };
    const catalog = resolveInheritedMemberCatalog(input);
    for (const memberName of ["own", "injected", "dynamic"]) {
      const origins = resolveMemberOrigins({ ...input, memberName });
      assert.equal(origins.length, memberName === "dynamic" && !includeMethodAssignedFields ? 0 : 1);
      assert.deepEqual(catalog.filter((origin) => origin.memberName === memberName), origins);
    }
  }
});

for (const cycle of ["ancestors", "current", "imported", "self"]) {
  test(`FIX-02: terminates ${cycle} cycles and honors current-class inclusion`, (context) => {
    const file = moduleGraph(context, {
      "base.js": `import { Subject } from './subject.js'; export class Middle extends Subject { inherited() {} }`,
      "subject.js": cycle === "imported"
        ? `import { Middle } from './base.js';
export class Subject extends Middle { inspect() {} }`
        : cycle === "self"
          ? "class Subject extends Subject { inspect() {} }"
          : `class Root extends ${cycle === "current" ? "Subject" : "Middle"} { inherited() {} }
class Middle extends Root {}
class Subject extends Middle { inspect() {} }`
    });
    const input = documentInput(file("subject.js"), "inspect()");
    for (const includeCurrentClass of [false, true]) {
      const options = { ...input, includeCurrentClass };
      const catalog = resolveInheritedMemberCatalog(options);
      assert.equal(catalog.filter((origin) => origin.memberName === "inspect").length, includeCurrentClass ? 1 : 0);
      for (const memberName of ["inspect", "inherited", "missing"]) {
        const origins = resolveMemberOrigins({ ...options, memberName });
        assert.deepEqual(origins, catalog.filter((origin) => origin.memberName === memberName));
        assert.equal(origins.length, memberName === "inspect" ? Number(includeCurrentClass) : memberName === "inherited" && cycle !== "self" ? 1 : 0);
      }
    }
  });
}

for (const mode of ["import", "reexport"]) {
  test(`FIX-03: resolves a renamed ${mode} to its exported identity`, (context) => {
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
