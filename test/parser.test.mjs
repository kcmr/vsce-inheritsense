import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseJavaScript } from "../dist/parser/ast.js";
import { extractFileSymbols } from "../dist/parser/symbols.js";
import { resolveProvidersFromSuperClass } from "../dist/resolver/inheritanceResolver.js";
import { fixturePath, sourceLine, fixtureSource } from "./helpers.mjs";

test("extracts methods, accessors, literal keys, and explicit/constructor fields with locations", () => {
  const source = fixtureSource("scenarios/static/parser/extracts-methods-accessors-literal-keys-and-explicit-constructor-fields-with-locations/subject.js");
  const { classes } = extractFileSymbols(source, "example.js");
  assert.equal(classes.length, 1);
  assert.equal(classes[0].name, "Example");
  assert.deepEqual(classes[0].members, [
    { name: "count", kind: "field", line: 2 },
    { name: "run", kind: "method", line: 4 },
    { name: "value", kind: "getter", line: 5 },
    { name: "value", kind: "setter", line: 6 },
    { name: "literalMethod", kind: "method", line: 7 },
    { name: "later", kind: "method", line: 8 },
    { name: "ready", kind: "field", line: 3 }
  ]);
});

test("fixture strict mode includes declarative/constructor fields but excludes method-assigned fields", () => {
  const filePath = fixturePath("base/configurable-component.js");
  const source = readFileSync(filePath, "utf8");
  const symbols = extractFileSymbols(source, filePath);
  const component = symbols.classes.find((item) => item.name === "ConfigurableComponent");
  assert.ok(component);
  for (const [name, marker] of [
    ["isEnabled", "isEnabled: {"], ["needsRefresh", "needsRefresh: {"],
    ["_taskState", "this._taskState ="]
  ]) {
    assert.deepEqual(component.members.find((member) => member.name === name), {
      name, kind: "field", line: sourceLine(source, marker)
    });
  }
  assert.equal(component.members.filter((member) => member.name === "needsRefresh").length, 1);
  assert(!component.members.some((member) => ["_label", "_resource"].includes(member.name)));
  assert.deepEqual(symbols.imports.get("eventMixin"), { source: "../mixins/event-mixin.js", importedName: "eventMixin" });
  assert(symbols.exportedInitializers.has("ConfigurableComponent"));
});

test("permissive mode discovers assignments inside methods and promise callbacks", () => {
  const filePath = fixturePath("base/configurable-component.js");
  const source = readFileSync(filePath, "utf8");
  const component = extractFileSymbols(source, filePath, {
    includeMethodAssignedFields: true
  }).classes.find((item) => item.name === "ConfigurableComponent");
  for (const name of ["_label", "_resource"]) {
    assert.deepEqual(component.members.find((member) => member.name === name), {
      name, kind: "field", line: sourceLine(source, `this.${name} =`)
    });
  }
});

test("permissive mode does not expose assignments to static this as instance fields", () => {
  const source = fixtureSource("scenarios/static/parser/permissive-mode-does-not-expose-assignments-to-static-this-as-instance-fields/subject.js");
  const { members } = extractFileSymbols(source, "example.js", {
    includeMethodAssignedFields: true
  }).classes[0];
  assert(members.some((member) => member.name === "instanceOnly"));
  assert(!members.some((member) => member.name === "staticOnly"));
});

test("recognizes block, expression, and wrapped class-returning factories", () => {
  const source = fixtureSource("scenarios/static/parser/recognizes-block-expression-and-wrapped-class-returning-factories/subject.js");
  const { classes } = extractFileSymbols(source, "factories.js");
  assert.deepEqual(classes.map(({ name, members }) => [name, members[0].name]), [
    ["ExpressionFactory", "first"], ["BlockFactory", "second"], ["WrappedFactory", "third"]
  ]);
});

test("extracts direct, delegated, and dynamic-bag injectors without looping on delegation cycles", () => {
  const source = fixtureSource("scenarios/static/parser/extracts-direct-delegated-and-dynamic-bag-injectors-without-looping-on-delegation-cycles/subject.js");
  const { injectors, classes } = extractFileSymbols(source, "injectors.js");
  assert.deepEqual(injectors.get("copy").map(({ name, kind }) => [name, kind]), [
    ["execute", "method"], ["enabled", "field"], ["label", "field"]
  ]);
  assert.deepEqual(injectors.get("install").map(({ name }) => name).sort(), [
    "enabled", "execute", "label", "reset"
  ]);
  assert.deepEqual(classes[0].injectorCalls, [{ localName: "install" }]);
});

test("collects nested providers in composition order and deduplicates references", () => {
  const source = fixtureSource("scenarios/static/parser/collects-nested-providers-in-composition-order-and-deduplicates-references/subject.js");
  const superClass = extractFileSymbols(source, "example.js").classes[0].superClass;
  assert.deepEqual(resolveProvidersFromSuperClass(superClass), [
    { localName: "outer", notes: "factory/mixin call" },
    { localName: "inner", importLookupName: "namespace", notes: "factory/mixin call" },
    { localName: "Base", notes: "factory argument" }
  ]);
  assert.deepEqual(resolveProvidersFromSuperClass(null), []);
});

test("preserves JSDoc comments and reports unrecoverable syntax errors", () => {
  const filePath = fixturePath("mixins/event-mixin.js");
  const ast = parseJavaScript(readFileSync(filePath, "utf8"), filePath);
  assert(ast.comments.some((comment) => comment.value.includes("@param {Event} event")));
  assert.throws(() => parseJavaScript(fixtureSource("scenarios/malformed/parser/unrecoverable-syntax/invalid.js"), "invalid.js"), SyntaxError);
});

test("REF-03: preserves injector computed-key policies and dynamic-bag recognition guards", () => {
  const source = fixtureSource("scenarios/static/parser/injector-recognition-boundaries/subject.js");
  const { injectors } = extractFileSymbols(source, "injectors.js");
  assert.deepEqual(injectors.get("install"), [
    { name: "direct", kind: "method", line: 7 },
    { name: "literalDirect", kind: "field", line: 8 },
    { name: "run", kind: "method", line: 1 },
    { name: "enabled", kind: "field", line: 1 },
    { name: "dynamicKey", kind: "method", line: 2 },
    { name: "literal", kind: "field", line: 3 }
  ]);
  assert.deepEqual(injectors.get("rejected"), [
    { name: "other", kind: "field", line: 21 },
    { name: "key", kind: "field", line: 22 }
  ]);
});
