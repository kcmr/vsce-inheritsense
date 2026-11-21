import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseJavaScript } from "../dist/parser/ast.js";
import { extractFileSymbols } from "../dist/parser/symbols.js";
import { resolveProvidersFromSuperClass } from "../dist/resolver/inheritanceResolver.js";
import { fixturePath, sourceLine } from "./helpers.mjs";

test("extracts methods, accessors, literal keys, and explicit/constructor fields with locations", () => {
  const source = `export class Example {
    count = 0;
    constructor() { this.ready = true; }
    run() {}
    get value() { return this.count; }
    set value(next) { this.count = next; }
    "literalMethod"() {}
    later() { this.dynamic = true; }
  }`;
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
  const source = `class Example {
    static configure() { this.staticOnly = true; }
    configure() { this.instanceOnly = true; }
  }`;
  const { members } = extractFileSymbols(source, "example.js", {
    includeMethodAssignedFields: true
  }).classes[0];
  assert(members.some((member) => member.name === "instanceOnly"));
  assert(!members.some((member) => member.name === "staticOnly"));
});

test("recognizes block, expression, and wrapped class-returning factories", () => {
  const source = `
    const ExpressionFactory = parent => class extends parent { first() {} };
    function BlockFactory(parent) { return class extends parent { second() {} }; }
    export const WrappedFactory = wrapper(parent => class extends parent { third() {} });
  `;
  const { classes } = extractFileSymbols(source, "factories.js");
  assert.deepEqual(classes.map(({ name, members }) => [name, members[0].name]), [
    ["ExpressionFactory", "first"], ["BlockFactory", "second"], ["WrappedFactory", "third"]
  ]);
});

test("extracts direct, delegated, and dynamic-bag injectors without looping on delegation cycles", () => {
  const source = `
    const members = { execute: () => {}, enabled: true };
    members.label = "sample";
    function copy(target) {
      Object.entries(members).forEach(([key, value]) => { target[key] = value; });
    }
    function direct(target) { target.reset = () => {}; copy(target); }
    function install(target) { direct(target); cycle(target); }
    function cycle(target) { install(target); }
    class Example { constructor() { install(this); install(this); } }
  `;
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
  const source = "class Example extends outer(namespace.inner(Base), Base) {}";
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
  assert.throws(() => parseJavaScript("class {", "invalid.js"), SyntaxError);
});
