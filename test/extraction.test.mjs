import assert from "node:assert/strict";
import { test } from "node:test";
import { extractFileSymbols } from "../dist/parser/symbols.js";
import { resolveMemberOrigins, resolveInheritedMemberCatalog } from "../dist/resolver/memberResolver.js";
import { assertOrigin, documentInput, sourceLine, fixtureGraph, fixtureSource } from "./helpers.mjs";

const factories = [
  ["named arrow", "scenarios/static/extraction/named-arrow", "Base"],
  ["wrapped arrow", "scenarios/static/extraction/wrapped-arrow", "Base"],
  ["function return", "scenarios/static/extraction/function-return", "Base"],
  ["nested returns", "scenarios/static/extraction/nested-returns", "Base"],
  ["callee factory", "scenarios/static/extraction/callee-factory", "Base"],
  ["default arrow", "scenarios/static/extraction/default-arrow", "default"],
  ["default function", "scenarios/static/extraction/default-function", "Factory"],
  ["class expression", "scenarios/static/extraction/class-expression", "Base"]
];

for (const [label, fixture, ownerName] of factories) {
  for (const includeMethodAssignedFields of [false, true]) {
    test(`REF-02: ${label} extraction preserves members in ${includeMethodAssignedFields ? "permissive" : "strict"} mode`, (context) => {
      const file = fixtureGraph(context, fixture);
      const sourceCode = fixtureSource(`${fixture}/base.js`);
      const input = { ...documentInput(file("subject.js"), "inspect()"), includeMethodAssignedFields, includeCurrentClass: false };
      const members = [
        ["execute", "method", "execute()"],
        ["value", "getter", "get value()"],
        ["value", "setter", "set value("],
        ["literal-method", "method", "'literal-method'()"],
        ["literal-field", "field", "'literal-field' ="],
        ["properties", "getter", "static get properties()"],
        ["configure", "method", "configure()"],
        ["setup", "method", "static setup()"],
        ["declared", "field", "return { declared:"],
        ["literal-property", "field", "return { declared:"],
        ["initialized", "field", "this.initialized"],
        ["lexical", "field", "this.lexical"]
      ];
      if (includeMethodAssignedFields) members.push(["dynamic", "field", "this.dynamic"]);
      const symbols = extractFileSymbols(sourceCode, file("base.js"), { includeMethodAssignedFields });
      assert.deepEqual(symbols.classes[0].members, members.map(([name, kind, marker]) => ({ name, kind, line: sourceLine(sourceCode, marker) })));
      const catalog = resolveInheritedMemberCatalog(input);
      assert.equal(catalog.length, members.length);
      for (const [index, [memberName, kind, marker]] of members.entries()) {
        assertOrigin(catalog[index], { memberName, kind, marker, ownerName, filePath: file("base.js"), confidence: "high" });
        assert.deepEqual(resolveMemberOrigins({ ...input, memberName }), [catalog.find((origin) => origin.memberName === memberName)]);
      }
      for (const memberName of ["foreign", "privateField", "dynamicKey", "staticAssigned", ...(includeMethodAssignedFields ? [] : ["dynamic"])]) {
        assert.deepEqual(resolveMemberOrigins({ ...input, memberName }), []);
      }
    });
  }
}

test("REF-02: inherited constructors are excluded consistently from lookup and catalogs", (context) => {
  const file = fixtureGraph(context, "scenarios/static/extraction/inherited-constructors-are-excluded-consistently-from-lookup-and-catalogs");
  const input = documentInput(file("subject.js"), "inspect()");
  assert.deepEqual(resolveInheritedMemberCatalog(input), []);
  assert.deepEqual(resolveMemberOrigins({ ...input, memberName: "constructor" }), []);
});

test("REF-02: class and injector deduplication retain their distinct source and kind contracts", () => {
  const source = fixtureSource("scenarios/static/extraction/class-and-injector-deduplication-retain-their-distinct-source-and-kind-contracts/subject.js");
  const symbols = extractFileSymbols(source, "contracts.js");
  assert.deepEqual(symbols.classes[0].members.map(({ name, kind }) => [name, kind]), [["run", "method"], ["value", "getter"], ["value", "setter"], ["run", "field"]]);
  assert.equal(symbols.classes[0].members[0].line, sourceLine(source, "  run()"));
  assert.deepEqual(symbols.classes[0].injectorCalls, [{ localName: "install", importLookupName: "ns" }]);
  const injected = symbols.injectors.get("install");
  assert.deepEqual(injected.map(({ name, kind }) => [name, kind]), [["run", "method"], ["run", "method"], ["run", "method"], ["label", "field"]]);
  assert.equal(new Set(injected.map(({ line }) => line)).size, 3);
});
