import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveMemberOrigins, resolveInheritedMemberCatalog } from "../dist/resolver/memberResolver.js";
import { assertOrigin, documentInput, fixturePath, fixtureGraph } from "./helpers.mjs";

const sampleInput = () => ({
  ...documentInput(fixturePath("components/sample-component.js"), "this.loadResource()"),
  includeCurrentClass: false
});

test("resolves nested factory and mixin members with exact origin metadata", () => {
  for (const [memberName, kind, ownerName, relativePath, marker] of [
    ["loadResource", "method", "ConfigurableComponent", "base/configurable-component.js", "loadResource()"],
    ["isPending", "getter", "ConfigurableComponent", "base/configurable-component.js", "get isPending()"],
    ["isEnabled", "field", "ConfigurableComponent", "base/configurable-component.js", "isEnabled: {"],
    ["_taskState", "field", "ConfigurableComponent", "base/configurable-component.js", "this._taskState ="],
    ["handleEvent", "method", "eventMixin", "mixins/event-mixin.js", "handleEvent(event)"],
    ["emitSignal", "method", "ComponentCore", "core/component-core.js", "emitSignal(type, payload)"]
  ]) {
    const origins = resolveMemberOrigins({ ...sampleInput(), memberName });
    assert.equal(origins.length, 1, memberName);
    assertOrigin(origins[0], {
      memberName, kind, ownerName, filePath: fixturePath(relativePath), marker, confidence: "high"
    });
  }
});

test("strict and permissive lookup/catalog agree on dynamic fields", () => {
  const strictCatalog = resolveInheritedMemberCatalog(sampleInput());
  const permissiveInput = { ...sampleInput(), includeMethodAssignedFields: true };
  const permissiveCatalog = resolveInheritedMemberCatalog(permissiveInput);
  for (const [memberName, relativePath] of [
    ["_resource", "base/configurable-component.js"],
    ["_label", "base/configurable-component.js"],
    ["_lastEvent", "mixins/event-mixin.js"]
  ]) {
    assert.deepEqual(resolveMemberOrigins({ ...sampleInput(), memberName }), []);
    assert(!strictCatalog.some((origin) => origin.memberName === memberName));
    const origins = resolveMemberOrigins({ ...permissiveInput, memberName });
    assert.equal(origins.length, 1);
    assertOrigin(origins[0], {
      memberName, kind: "field", ownerName: memberName === "_lastEvent" ? "eventMixin" : "ConfigurableComponent",
      filePath: fixturePath(relativePath), marker: `this.${memberName} =`
    });
    assert.deepEqual(permissiveCatalog.filter((origin) => origin.memberName === memberName), origins);
  }
});

test("catalog contains unique inherited entries and optionally current-class members", () => {
  const inherited = resolveInheritedMemberCatalog(sampleInput());
  const names = inherited.map((origin) => origin.memberName);
  for (const name of ["handleEvent", "emitSignal", "isEnabled", "needsRefresh", "_taskState"]) {
    assert(names.includes(name), name);
  }
  assert.equal(names.filter((name) => name === "needsRefresh").length, 1);
  assert(!names.includes("snapshot"));
  assert(!names.includes("summary"));
  const withLocal = resolveInheritedMemberCatalog({ ...sampleInput(), includeCurrentClass: true });
  assert(withLocal.some((origin) => origin.memberName === "snapshot" && origin.ownerName === "SampleComponent"));
  assert.equal(new Set(withLocal.map((origin) => JSON.stringify(origin))).size, withLocal.length);
});

test("lookup includes the current class by default and honors exclusion", () => {
  const input = documentInput(fixturePath("components/sample-component.js"), "get summary()");
  const origins = resolveMemberOrigins({ ...input, memberName: "summary" });
  assert.equal(origins.length, 1);
  assertOrigin(origins[0], {
    memberName: "summary", kind: "getter", ownerName: "SampleComponent",
    filePath: input.filePath, marker: "get summary()", confidence: "high"
  });
  assert.deepEqual(resolveMemberOrigins({ ...input, memberName: "summary", includeCurrentClass: false }), []);
});

test("resolves imported injectors delegated through another function", (context) => {
  const file = fixtureGraph(context, "scenarios/static/resolver/resolves-imported-injectors-delegated-through-another-function");
  const input = documentInput(file("subject.js"), "inspect()");
  const origins = resolveMemberOrigins({ ...input, memberName: "execute" });
  assert.equal(origins.length, 1);
  assertOrigin(origins[0], {
    memberName: "execute", kind: "method", ownerName: "install",
    filePath: file("install.js"), marker: "target.execute =", confidence: "medium"
  });
  assert.equal(origins[0].notes, "runtime injector call");
  assert.deepEqual(resolveInheritedMemberCatalog(input).filter((origin) => origin.memberName === "execute"), origins);
});

test("resolves a local base-class injector from a dynamic member bag", (context) => {
  const file = fixtureGraph(context, "scenarios/static/resolver/resolves-a-local-base-class-injector-from-a-dynamic-member-bag");
  const input = documentInput(file("subject.js"), "inspect()");
  for (const [memberName, kind] of [["execute", "method"], ["ready", "field"]]) {
    const origins = resolveMemberOrigins({ ...input, memberName });
    assert.equal(origins.length, 1);
    assertOrigin(origins[0], {
      memberName, kind, ownerName: "install", filePath: file("subject.js"),
      marker: "const members =", confidence: "medium"
    });
  }
});

test("resolves multi-file inheritance and same-name reexports", (context) => {
  const file = fixtureGraph(context, "scenarios/static/resolver/resolves-multi-file-inheritance-and-same-name-reexports");
  const input = documentInput(file("subject.js"), "inspect()");
  const origins = resolveMemberOrigins({ ...input, memberName: "execute" });
  assert.equal(origins.length, 1);
  assertOrigin(origins[0], {
    memberName: "execute", kind: "method", ownerName: "Root", filePath: file("root.js"),
    marker: "execute()", confidence: "high"
  });
  assert.deepEqual(resolveInheritedMemberCatalog(input), origins);
});

test("terminates on cyclic imported inheritance", (context) => {
  const file = fixtureGraph(context, "scenarios/static/resolver/terminates-on-cyclic-imported-inheritance");
  const input = documentInput(file("subject.js"), "inspect()");
  assert.deepEqual(resolveMemberOrigins({ ...input, memberName: "missing" }), []);
  assert.deepEqual(resolveInheritedMemberCatalog(input).map((origin) => origin.memberName).sort(), ["fromA", "fromB"]);
});

test("returns no origins outside a class or for a missing member", () => {
  const input = sampleInput();
  assert.deepEqual(resolveMemberOrigins({ ...input, memberName: "absent" }), []);
  assert.deepEqual(resolveMemberOrigins({ ...input, line: 1, memberName: "handleEvent" }), []);
  assert.deepEqual(resolveInheritedMemberCatalog({ ...input, line: 1 }), []);
});

test("missing imported files produce empty results without throwing", (context) => {
  const file = fixtureGraph(context, "scenarios/static/resolver/missing-imported-files-produce-empty-results-without-throwing");
  const input = documentInput(file("subject.js"), "inspect()");
  assert.deepEqual(resolveMemberOrigins({ ...input, memberName: "execute" }), []);
  assert.deepEqual(resolveInheritedMemberCatalog(input), []);
});
