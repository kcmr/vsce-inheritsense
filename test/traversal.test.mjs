import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveMemberOrigins, resolveInheritedMemberCatalog } from "../dist/resolver/memberResolver.js";
import { assertOrigin, documentInput, moduleGraph } from "./helpers.mjs";

for (const includeMethodAssignedFields of [false, true]) {
  test(`REF-01: lookup/catalog retain precedence and metadata in ${includeMethodAssignedFields ? "permissive" : "strict"} mode`, (context) => {
    const file = moduleGraph(context, {
      "install.js": `export function install(target) { target.injected = true; target.execute = () => {}; }`,
      "root.js": `export class Root { execute() {} inherited() {} }
export { install as PublicInstall } from './install.js';`,
      "base.js": `import { Root as Parent, PublicInstall as apply } from './root.js';
export class Base extends Parent {
  constructor() { apply(this); }
  execute() {}
  configure() { this.dynamic = true; }
  get value() { return 1; }
  set value(next) {}
}`,
      "subject.js": `import { Base as Parent } from './base.js';
class Subject extends Parent { inspect() {} }`
    });
    const input = { ...documentInput(file("subject.js"), "inspect()"), includeMethodAssignedFields };
    const catalog = resolveInheritedMemberCatalog(input);
    for (const [memberName, ownerName, kind, originFile, marker, confidence] of [
      ["execute", "Base", "method", "base.js", "execute()", "high"],
      ["injected", "install", "field", "install.js", "target.injected", "medium"],
      ["inherited", "Root", "method", "root.js", "inherited()", "high"],
      ["value", "Base", "getter", "base.js", "get value()", "high"]
    ]) {
      const origins = resolveMemberOrigins({ ...input, memberName });
      assert.equal(origins.length, 1);
      assertOrigin(origins[0], { memberName, ownerName, kind, filePath: file(originFile), marker, confidence });
      assert.deepEqual(origins[0], catalog.find((origin) => origin.memberName === memberName));
    }
    assert.deepEqual(catalog.filter((origin) => origin.memberName === "execute").map(({ ownerName }) => ownerName), ["Base", "install", "Root"]);
    assert.deepEqual(catalog.filter((origin) => origin.memberName === "value").map(({ kind }) => kind), ["getter", "setter"]);
    const dynamic = resolveMemberOrigins({ ...input, memberName: "dynamic" });
    assert.equal(dynamic.length, Number(includeMethodAssignedFields));
    assert.deepEqual(dynamic, catalog.filter((origin) => origin.memberName === "dynamic"));
    assert.deepEqual(resolveMemberOrigins({ ...input, memberName: "missing" }), []);
  });
}

test("REF-01: lookup keeps one match per root provider and catalog deduplicates shared ancestors", (context) => {
  const file = moduleGraph(context, {
    "providers.js": `class Shared { execute() {} sharedOnly() {} }
export const Outer = parent => class extends Shared { execute() {} };
export class Inner extends Shared { execute() {} }`,
    "subject.js": `import { Outer, Inner } from './providers.js';
class Subject extends Outer(Inner) { execute() {} inspect() {} }`
  });
  const input = documentInput(file("subject.js"), "inspect()");
  assert.deepEqual(resolveMemberOrigins({ ...input, memberName: "execute" }).map(({ ownerName }) => ownerName), ["Subject", "Outer", "Inner"]);
  const inherited = resolveMemberOrigins({ ...input, memberName: "execute", includeCurrentClass: false });
  assert.deepEqual(inherited.map(({ ownerName }) => ownerName), ["Outer", "Inner"]);
  const catalog = resolveInheritedMemberCatalog(input);
  assert.deepEqual(catalog.filter((origin) => origin.memberName === "execute").map(({ ownerName }) => ownerName), ["Outer", "Shared", "Inner"]);
  assert.equal(catalog.filter((origin) => origin.memberName === "sharedOnly").length, 1);
  assert.deepEqual(resolveMemberOrigins({ ...input, memberName: "sharedOnly" }), catalog.filter((origin) => origin.memberName === "sharedOnly"));
  assert.equal(resolveInheritedMemberCatalog({ ...input, includeCurrentClass: true })[0].ownerName, "Subject");
});

for (const stage of ["declaration", "injector", "nested provider"]) {
  test(`REF-01: lookup stops after a ${stage} match before parsing later branches`, (context) => {
    const sources = {
      declaration: `import { Broken } from './broken.js';
export class Base extends Broken { execute() {} }`,
      injector: `import { Broken } from './broken.js';
function install(target) { target.execute = () => {}; }
export class Base { constructor() { install(this); Broken(this); } }`,
      "nested provider": `import { Broken } from './broken.js';
class Ready { execute() {} }
export class Base extends Ready(Broken) {}`
    };
    const file = moduleGraph(context, {
      "broken.js": "class {",
      "base.js": sources[stage],
      "subject.js": "import { Base } from './base.js'; class Subject extends Base { inspect() {} }"
    });
    const input = documentInput(file("subject.js"), "inspect()");
    const origins = resolveMemberOrigins({ ...input, memberName: "execute" });
    assert.equal(origins.length, 1);
    assert.equal(origins[0].ownerName, stage === "declaration" ? "Base" : stage === "injector" ? "install" : "Ready");
    // Catalogs must visit every branch, so the same malformed module is observable.
    assert.throws(() => resolveInheritedMemberCatalog(input), SyntaxError);
    assert.throws(() => resolveMemberOrigins({ ...input, memberName: "missing" }), SyntaxError);
  });
}

test("REF-01: a match in one root provider does not suppress lookup in later root providers", (context) => {
  const file = moduleGraph(context, {
    "broken.js": "class {",
    "subject.js": `import { Broken } from './broken.js';
const Ready = parent => class { execute() {} };
class Subject extends Ready(Broken) { inspect() {} }`
  });
  const input = documentInput(file("subject.js"), "inspect()");
  assert.throws(() => resolveMemberOrigins({ ...input, memberName: "execute" }), SyntaxError);
});
