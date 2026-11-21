import assert from "node:assert/strict";
import { test } from "node:test";
import { extractFileSymbols } from "../dist/parser/symbols.js";
import { resolveMemberOrigins, resolveInheritedMemberCatalog } from "../dist/resolver/memberResolver.js";
import { assertOrigin, documentInput, moduleGraph } from "./helpers.mjs";

test("FIX-03: keeps imports, local exports, and reexports in separate identity maps", () => {
  const { imports, exports } = extractFileSymbols(`
import Default from './default.js';
import { Root as Local } from './root.js';
import * as namespace from './root.js';
export { Local as Public, Default as default };
export { Root as Remote } from './root.js';
export * as providers from './root.js';`, "subject.js");
  assert.deepEqual([...imports], [
    ["Default", { source: "./default.js", importedName: "default" }],
    ["Local", { source: "./root.js", importedName: "Root" }],
    ["namespace", { source: "./root.js", importedName: null }]
  ]);
  assert.deepEqual([...exports], [
    ["Public", { localName: "Local" }], ["default", { localName: "Default" }],
    ["Remote", { source: "./root.js", importedName: "Root" }],
    ["providers", { source: "./root.js", importedName: null }]
  ]);
});

const classCases = [
  { name: "empty namespace export name", barrel: 'export * as "" from "./root.js";', imported: 'import { "" as ns } from "./barrel.js";', base: "ns.Root" },
  { name: "quoted export aliases", root: 'class Root { execute() {} } export { Root as "public-base" };', barrel: 'export { "public-base" as "public-api" } from "./root.js";', imported: 'import { "public-api" as Base } from "./barrel.js";' },
  { name: "anonymous default function factory", root: "export default function(parent) { return class extends parent { execute() {} }; }", imported: "import Base from './root.js';", base: "Base(Object)", owner: "default" },
  { name: "local export alias", root: "class Root { execute() {} } export { Root as Public };", imported: "import { Public as Base } from './root.js';" },
  { name: "import and reexport alias chain", barrel: "import { Root as Internal } from './root.js'; export { Internal as Public };", imported: "import { Public as Base } from './barrel.js';" },
  { name: "multiple remote aliases", barrel: "export { Root as First } from './root.js';", bridge: "export { First as Public } from './barrel.js';", imported: "import { Public as Base } from './bridge.js';" },
  { name: "named default class", root: "export default class Root { execute() {} }", imported: "import Base from './root.js';" },
  { name: "anonymous default class", root: "export default class { execute() {} }", imported: "import Base from './root.js';", owner: "default" },
  { name: "default identifier", root: "class Root { execute() {} } export default Root;", imported: "import Base from './root.js';" },
  { name: "default export list", root: "class Root { execute() {} } export { Root as default };", imported: "import Base from './root.js';" },
  { name: "default to named reexport", root: "export default class Root { execute() {} }", barrel: "export { default as Public } from './root.js';", imported: "import { Public as Base } from './barrel.js';" },
  { name: "named to default reexport", barrel: "export { Root as default } from './root.js';", imported: "import Base from './barrel.js';" },
  { name: "namespace member", imported: "import * as ns from './root.js';", base: "ns.Root" },
  { name: "namespace default member", root: "export default class Root { execute() {} }", imported: "import * as ns from './root.js';", base: "ns.default" },
  { name: "namespace reexport", barrel: "export * as providers from './root.js';", imported: "import { providers as ns } from './barrel.js';", base: "ns.Root" },
  { name: "local namespace reexport", barrel: "import * as internal from './root.js'; export { internal as providers };", imported: "import { providers as ns } from './barrel.js';", base: "ns.Root" },
  { name: "named default factory", root: "export default function Root(parent) { return class extends parent { execute() {} }; }", imported: "import Base from './root.js';", base: "Base(Object)" },
  { name: "anonymous default factory", root: "export default parent => class extends parent { execute() {} };", imported: "import Base from './root.js';", base: "Base(Object)", owner: "default" },
  { name: "renamed factory", root: "export const Root = parent => class extends parent { execute() {} };", barrel: "export { Root as Public } from './root.js';", imported: "import { Public as Base } from './barrel.js';", base: "Base(Object)" }
];

for (const example of classCases) {
  test(`FIX-03: lookup/catalog resolve ${example.name}`, (context) => {
    const file = moduleGraph(context, {
      "root.js": example.root ?? "export class Root { execute() {} }",
      "barrel.js": example.barrel ?? "",
      "bridge.js": example.bridge ?? "",
      "subject.js": `${example.imported}
class Subject extends ${example.base ?? "Base"} { inspect() {} }`
    });
    const input = documentInput(file("subject.js"), "inspect()");
    const origins = resolveMemberOrigins({ ...input, memberName: "execute" });
    assert.equal(origins.length, 1);
    assertOrigin(origins[0], {
      memberName: "execute", kind: "method", ownerName: example.owner ?? "Root",
      filePath: file("root.js"), marker: "execute()", confidence: "high"
    });
    assert.deepEqual(resolveInheritedMemberCatalog(input), origins);
  });
}

const injectorCases = [
  { name: "default identifier through a barrel", root: "function install(target) { target.injected = true; } export default install;", barrel: "export { default as Public } from './root.js';", imported: "import { Public as apply } from './barrel.js';", callee: "apply", owner: "install" },
  { name: "named alias", root: "export function install(target) { target.injected = true; }", barrel: "export { install as Public } from './root.js';", imported: "import { Public as apply } from './barrel.js';", callee: "apply", owner: "install" },
  { name: "local alias", root: "function install(target) { target.injected = true; } export { install as Public };", imported: "import { Public as apply } from './root.js';", callee: "apply", owner: "install" },
  { name: "named default", root: "export default function install(target) { target.injected = true; }", imported: "import apply from './root.js';", callee: "apply", owner: "install" },
  { name: "anonymous default", root: "export default function(target) { target.injected = true; }", imported: "import apply from './root.js';", callee: "apply", owner: "default" },
  { name: "default arrow", root: "export default target => { target.injected = true; };", imported: "import apply from './root.js';", callee: "apply", owner: "default" },
  { name: "namespace", root: "export function install(target) { target.injected = true; }", imported: "import * as ns from './root.js';", callee: "ns.install", owner: "install" },
  { name: "namespace reexport", root: "export function install(target) { target.injected = true; }", barrel: "export * as providers from './root.js';", imported: "import { providers as ns } from './barrel.js';", callee: "ns.install", owner: "install" }
];

for (const example of injectorCases) {
  test(`FIX-03: injector lookup/catalog resolve ${example.name}`, (context) => {
    const file = moduleGraph(context, {
      "root.js": example.root,
      "barrel.js": example.barrel ?? "",
      "base.js": `${example.imported}
export class Base { constructor() { ${example.callee}(this); } }`,
      "subject.js": "import { Base } from './base.js'; class Subject extends Base { inspect() {} }"
    });
    const input = documentInput(file("subject.js"), "inspect()");
    const origins = resolveMemberOrigins({ ...input, memberName: "injected" });
    assert.equal(origins.length, 1);
    assertOrigin(origins[0], {
      memberName: "injected", kind: "field", ownerName: example.owner,
      filePath: file("root.js"), marker: "target.injected", confidence: "medium"
    });
    assert.deepEqual(resolveInheritedMemberCatalog(input), origins);
  });
}

for (const example of [
  { name: "nested namespace qualifiers", root: "export class Root { execute() {} }", imported: "import * as ns from './root.js'; class Root { execute() {} }", base: "ns.sub.Root" },
  { name: "unexported declaration", root: "class Root { execute() {} } export class Other {}", imported: "import { Root as Base } from './root.js';", base: "Base" },
  { name: "missing default", root: "export class Base { execute() {} }", imported: "import Base from './root.js';", base: "Base" },
  { name: "bare namespace", root: "export class ns { execute() {} }", imported: "import * as ns from './root.js';", base: "ns" },
  { name: "namespace member colliding with a local class", root: "export class Other {}", imported: "import * as ns from './root.js'; class Root { execute() {} }", base: "ns.Root" },
  { name: "instance property on a default class", root: "export default class Root { execute() {} }", imported: "import ns from './root.js'; class Root { execute() {} }", base: "ns.Root" },
  { name: "wildcard export", root: "export class Root { execute() {} }", barrel: "export * from './root.js';", imported: "import { Root as Base } from './barrel.js';", base: "Base" }
]) {
  test(`FIX-03: rejects ${example.name}`, (context) => {
    const file = moduleGraph(context, {
      "root.js": example.root,
      "barrel.js": example.barrel ?? "",
      "subject.js": `${example.imported}\nclass Subject extends ${example.base} { inspect() {} }`
    });
    const input = documentInput(file("subject.js"), "inspect()");
    assert.deepEqual(resolveMemberOrigins({ ...input, memberName: "execute" }), []);
    assert.deepEqual(resolveInheritedMemberCatalog(input), []);
  });
}

test("FIX-03: aliased providers preserve strict/permissive discovery and precedence", (context) => {
  const file = moduleGraph(context, {
    "root.js": `export class Root {
  execute() {}
  configure() { this.dynamic = true; }
}
export class Middle extends Root { execute() {} }`,
    "barrel.js": "export { Middle as Public } from './root.js';",
    "subject.js": "import { Public as Base } from './barrel.js'; class Subject extends Base { inspect() {} }"
  });
  for (const includeMethodAssignedFields of [false, true]) {
    const input = { ...documentInput(file("subject.js"), "inspect()"), includeMethodAssignedFields };
    const origins = resolveMemberOrigins({ ...input, memberName: "execute" });
    assert.equal(origins.length, 1);
    assert.equal(origins[0].ownerName, "Middle");
    const catalog = resolveInheritedMemberCatalog(input);
    assert.deepEqual(catalog.filter((origin) => origin.memberName === "execute").map(({ ownerName }) => ownerName), ["Middle", "Root"]);
    const dynamic = resolveMemberOrigins({ ...input, memberName: "dynamic" });
    assert.equal(dynamic.length, Number(includeMethodAssignedFields));
    assert.deepEqual(catalog.filter((origin) => origin.memberName === "dynamic"), dynamic);
  }
});

for (const injector of [false, true]) {
  test(`FIX-03: terminates renamed ${injector ? "injector" : "provider"} reexport cycles`, (context) => {
    const file = moduleGraph(context, {
      "a.js": "export { Second as First } from './b.js';",
      "b.js": "export { First as Second } from './a.js';",
      "base.js": "import { First as apply } from './a.js'; export class Base { constructor() { apply(this); } }",
      "subject.js": injector
        ? "import { Base } from './base.js'; class Subject extends Base { inspect() {} }"
        : "import { First as Base } from './a.js'; class Subject extends Base { inspect() {} }"
    });
    const input = documentInput(file("subject.js"), "inspect()");
    assert.deepEqual(resolveMemberOrigins({ ...input, memberName: "missing" }), []);
    assert.deepEqual(resolveInheritedMemberCatalog(input), []);
  });
}

test("FIX-03: namespace injector calls do not fall back to a same-named local function", (context) => {
  const file = moduleGraph(context, {
    "root.js": "export function other(target) { target.other = true; }",
    "subject.js": `import * as ns from './root.js';
function install(target) { target.foreign = true; }
class Base { constructor() { ns.install(this); ns.sub.install(this); } }
class Subject extends Base { inspect() {} }`
  });
  const input = documentInput(file("subject.js"), "inspect()");
  assert.deepEqual(resolveMemberOrigins({ ...input, memberName: "foreign" }), []);
  assert.deepEqual(resolveInheritedMemberCatalog(input), []);
});
