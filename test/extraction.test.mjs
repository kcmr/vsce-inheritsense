import assert from "node:assert/strict";
import { test } from "node:test";
import { extractFileSymbols } from "../dist/parser/symbols.js";
import { resolveMemberOrigins, resolveInheritedMemberCatalog } from "../dist/resolver/memberResolver.js";
import { assertOrigin, documentInput, moduleGraph, sourceLine } from "./helpers.mjs";

const body = `
  constructor() {
    this.initialized = true;
    const arrow = () => { this.lexical = true; };
    function other() { this.foreign = true; }
  }
  execute() {}
  get value() { return 1; }
  set value(next) {}
  'literal-method'() {}
  'literal-field' = true;
  #privateField = true;
  [dynamicKey]() {}
  static get properties() { return { declared: {}, 'literal-property': {} }; }
  configure() { this.dynamic = true; }
  static setup() { this.staticAssigned = true; }
`;

const factories = [
  ["named arrow", `export const Base = parent => class { ${body} };`, "Base"],
  ["wrapped arrow", `export const Base = wrap(parent => class { ${body} });`, "Base"],
  ["function return", `export function Base() { return class { ${body} }; }`, "Base"],
  ["nested returns", `const Base = () => { return () => { return class { ${body} }; }; }; export { Base };`, "Base"],
  ["callee factory", `export const Base = (() => class { ${body} })();`, "Base"],
  ["default arrow", `export default parent => class { ${body} };`, "default"],
  ["default function", `export default function Factory() { return class { ${body} }; }`, "Factory"],
  ["class expression", `export const Base = class { ${body} };`, "Base"]
];

for (const [label, sourceCode, ownerName] of factories) {
  for (const includeMethodAssignedFields of [false, true]) {
    test(`REF-02: ${label} extraction preserves members in ${includeMethodAssignedFields ? "permissive" : "strict"} mode`, (context) => {
      const file = moduleGraph(context, {
        "base.js": sourceCode,
        "subject.js": `import ${ownerName === "Base" ? "{ Base }" : "Base"} from './base.js';
class Subject extends Base { inspect() {} }`
      });
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
  const file = moduleGraph(context, {
    "base.js": "export const Base = () => class { constructor() {} };",
    "subject.js": "import { Base } from './base.js'; class Subject extends Base { inspect() {} }"
  });
  const input = documentInput(file("subject.js"), "inspect()");
  assert.deepEqual(resolveInheritedMemberCatalog(input), []);
  assert.deepEqual(resolveMemberOrigins({ ...input, memberName: "constructor" }), []);
});

test("REF-02: class and injector deduplication retain their distinct source and kind contracts", () => {
  const source = `const bag = { run: () => {}, 'label': true };
function install(target) {
  target.run = () => {};
  target.run = () => {};
  Object.entries(bag).forEach(([key, value]) => { target[key] = value; });
}
class Base {
  constructor() { this.run = () => {}; ns.install(this); ns.install(this); }
  run() {}
  run() {}
  get value() { return 1; }
  set value(next) {}
}`;
  const symbols = extractFileSymbols(source, "contracts.js");
  assert.deepEqual(symbols.classes[0].members.map(({ name, kind }) => [name, kind]), [["run", "method"], ["value", "getter"], ["value", "setter"], ["run", "field"]]);
  assert.equal(symbols.classes[0].members[0].line, sourceLine(source, "  run()"));
  assert.deepEqual(symbols.classes[0].injectorCalls, [{ localName: "install", importLookupName: "ns" }]);
  const injected = symbols.injectors.get("install");
  assert.deepEqual(injected.map(({ name, kind }) => [name, kind]), [["run", "method"], ["run", "method"], ["run", "method"], ["label", "field"]]);
  assert.equal(new Set(injected.map(({ line }) => line)).size, 3);
});
