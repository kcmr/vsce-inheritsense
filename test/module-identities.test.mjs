import assert from "node:assert/strict";
import { test } from "node:test";
import { extractFileSymbols } from "../dist/parser/symbols.js";
import { resolveMemberOrigins, resolveInheritedMemberCatalog } from "../dist/resolver/memberResolver.js";
import { assertOrigin, documentInput, fixtureGraph, fixtureSource } from "./helpers.mjs";

test("FIX-03: keeps imports, local exports, and reexports in separate identity maps", () => {
  const { imports, exports } = extractFileSymbols(fixtureSource("scenarios/static/module-identities/identity-maps/subject.js"), "subject.js");
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
  { name: "empty namespace export name", fixture: "scenarios/static/module-identities/classes/empty-namespace-export-name" },
  { name: "quoted export aliases", fixture: "scenarios/static/module-identities/classes/quoted-export-aliases" },
  { name: "anonymous default function factory", fixture: "scenarios/static/module-identities/classes/anonymous-default-function-factory", owner: "default" },
  { name: "local export alias", fixture: "scenarios/static/module-identities/classes/local-export-alias" },
  { name: "import and reexport alias chain", fixture: "scenarios/static/module-identities/classes/import-and-reexport-alias-chain" },
  { name: "multiple remote aliases", fixture: "scenarios/static/module-identities/classes/multiple-remote-aliases" },
  { name: "named default class", fixture: "scenarios/static/module-identities/classes/named-default-class" },
  { name: "anonymous default class", fixture: "scenarios/static/module-identities/classes/anonymous-default-class", owner: "default" },
  { name: "default identifier", fixture: "scenarios/static/module-identities/classes/default-identifier" },
  { name: "default export list", fixture: "scenarios/static/module-identities/classes/default-export-list" },
  { name: "default to named reexport", fixture: "scenarios/static/module-identities/classes/default-to-named-reexport" },
  { name: "named to default reexport", fixture: "scenarios/static/module-identities/classes/named-to-default-reexport" },
  { name: "namespace member", fixture: "scenarios/static/module-identities/classes/namespace-member" },
  { name: "namespace default member", fixture: "scenarios/static/module-identities/classes/namespace-default-member" },
  { name: "namespace reexport", fixture: "scenarios/static/module-identities/classes/namespace-reexport" },
  { name: "local namespace reexport", fixture: "scenarios/static/module-identities/classes/local-namespace-reexport" },
  { name: "named default factory", fixture: "scenarios/static/module-identities/classes/named-default-factory" },
  { name: "anonymous default factory", fixture: "scenarios/static/module-identities/classes/anonymous-default-factory", owner: "default" },
  { name: "renamed factory", fixture: "scenarios/static/module-identities/classes/renamed-factory" }
];

for (const example of classCases) {
  test(`FIX-03: lookup/catalog resolve ${example.name}`, (context) => {
    const file = fixtureGraph(context, example.fixture);
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
  { name: "default identifier through a barrel", fixture: "scenarios/static/module-identities/injectors/default-identifier-through-a-barrel", owner: "install" },
  { name: "named alias", fixture: "scenarios/static/module-identities/injectors/named-alias", owner: "install" },
  { name: "local alias", fixture: "scenarios/static/module-identities/injectors/local-alias", owner: "install" },
  { name: "named default", fixture: "scenarios/static/module-identities/injectors/named-default", owner: "install" },
  { name: "anonymous default", fixture: "scenarios/static/module-identities/injectors/anonymous-default", owner: "default" },
  { name: "default arrow", fixture: "scenarios/static/module-identities/injectors/default-arrow", owner: "default" },
  { name: "namespace", fixture: "scenarios/static/module-identities/injectors/namespace", owner: "install" },
  { name: "namespace reexport", fixture: "scenarios/static/module-identities/injectors/namespace-reexport", owner: "install" }
];

for (const example of injectorCases) {
  test(`FIX-03: injector lookup/catalog resolve ${example.name}`, (context) => {
    const file = fixtureGraph(context, example.fixture);
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
  { name: "nested namespace qualifiers", fixture: "scenarios/static/module-identities/negative/nested-namespace-qualifiers" },
  { name: "unexported declaration", fixture: "scenarios/static/module-identities/negative/unexported-declaration" },
  { name: "missing default", fixture: "scenarios/static/module-identities/negative/missing-default" },
  { name: "bare namespace", fixture: "scenarios/static/module-identities/negative/bare-namespace" },
  { name: "namespace member colliding with a local class", fixture: "scenarios/static/module-identities/negative/namespace-member-colliding-with-a-local-class" },
  { name: "instance property on a default class", fixture: "scenarios/static/module-identities/negative/instance-property-on-a-default-class" },
  { name: "wildcard export", fixture: "scenarios/static/module-identities/negative/wildcard-export" }
]) {
  test(`FIX-03: rejects ${example.name}`, (context) => {
    const file = fixtureGraph(context, example.fixture);
    const input = documentInput(file("subject.js"), "inspect()");
    assert.deepEqual(resolveMemberOrigins({ ...input, memberName: "execute" }), []);
    assert.deepEqual(resolveInheritedMemberCatalog(input), []);
  });
}

test("FIX-03: aliased providers preserve strict/permissive discovery and precedence", (context) => {
  const file = fixtureGraph(context, "scenarios/static/module-identities/aliased-providers-preserve-strict-permissive-discovery-and-precedence");
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
    const file = fixtureGraph(context, `scenarios/static/module-identities/cycles/${injector ? "injector" : "provider"}`);
    const input = documentInput(file("subject.js"), "inspect()");
    assert.deepEqual(resolveMemberOrigins({ ...input, memberName: "missing" }), []);
    assert.deepEqual(resolveInheritedMemberCatalog(input), []);
  });
}

test("FIX-03: namespace injector calls do not fall back to a same-named local function", (context) => {
  const file = fixtureGraph(context, "scenarios/static/module-identities/namespace-injector-calls-do-not-fall-back-to-a-same-named-local-function");
  const input = documentInput(file("subject.js"), "inspect()");
  assert.deepEqual(resolveMemberOrigins({ ...input, memberName: "foreign" }), []);
  assert.deepEqual(resolveInheritedMemberCatalog(input), []);
});
