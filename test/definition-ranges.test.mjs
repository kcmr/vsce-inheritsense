import assert from "node:assert/strict";
import { test } from "node:test";
import { extractFileSymbols } from "../dist/parser/symbols.js";
import { resolveMemberOrigins, resolveInheritedMemberCatalog } from "../dist/resolver/memberResolver.js";
import { fixtureGraph, fixturePath, fixtureSource, sourceLine } from "./helpers.mjs";
import { nativeDefinitionService, nativeDefinitionTargets, rangeText } from "./support/native-definitions.mjs";

const fixture = "scenarios/static/definition-ranges/subject.js";
const source = fixtureSource(fixture);
const filePath = fixturePath(fixture);
const options = { includeMemberRanges: true, includeMethodAssignedFields: true };
function resolve(memberName, marker = "inspectDirect()", sourceCode = source) {
  return resolveMemberOrigins({
    filePath, sourceCode, memberName, line: sourceLine(sourceCode, marker),
    includeCurrentClass: false, ...options
  });
}

test("FIX-04: declaration ranges are opt-in and preserve the normal class payload", () => {
  const normal = extractFileSymbols(source, filePath, { includeMethodAssignedFields: true });
  const precise = extractFileSymbols(source, filePath, options);
  const root = precise.classes.find((item) => item.name === "Root");
  const plain = root.members.map(({ range, ...member }) => {
    assert(range);
    return member;
  });
  assert.deepEqual(plain, normal.classes.find((item) => item.name === "Root").members);
  const names = new Map(root.members.map((member) => [member.name, rangeText(filePath, member.range)]));
  for (const name of ["execute", "asyncMethod", "value", "assigned", "declared", "dynamic"]) {
    assert.equal(names.get(name), name);
  }
  assert.equal(names.get("literal-method"), "'literal-method'");
  assert.equal(names.get("literal-field"), "'literal-field'");
  assert.equal(names.get("declared-literal"), "'declared-literal'");
  assert.equal(names.get("escaped"), "\\u0065scaped");
});

test("FIX-04: opt-in ranges survive injector assignments, bag delegation, and same-line sites", () => {
  const precise = extractFileSymbols(source, filePath, options);
  const members = precise.injectors.get("install");
  assert.deepEqual(members.map((member) => rangeText(filePath, member.range)), [
    "bagMethod", "'bag-field'", "extra", "injected", "'quotedInjected'"
  ]);
  const repeated = precise.injectors.get("repeat");
  assert.equal(repeated.length, 2);
  assert.notDeepEqual(repeated[0].range, repeated[1].range);
  assert.equal(extractFileSymbols(source, filePath).injectors.get("repeat").length, 1);
  const origins = resolveInheritedMemberCatalog({
    filePath, sourceCode: source, line: sourceLine(source, "this.execute"), ...options
  });
  assert.equal(origins.filter((origin) => origin.memberName === "twice").length, 2);
});

test("FIX-04: distinct same-line provider declarations retain separate definition ranges", () => {
  const origins = resolve("same", "class Multiple");
  assert.deepEqual(origins.map((origin) => origin.ownerName), ["First", "Second"]);
  assert.equal(origins[0].filePath, origins[1].filePath);
  assert.equal(origins[0].line, origins[1].line);
  assert.notDeepEqual(origins[0].range, origins[1].range);
  for (const origin of origins) assert.equal(rangeText(filePath, origin.range), "same");
});

test("FIX-04: native and extension targets agree for direct inheritance, modifiers, accessors, literals, and escapes", (context) => {
  const service = nativeDefinitionService(context, [filePath]);
  const start = source.indexOf("inspectDirect()");
  for (const [memberName, reference, offset] of [
    ["execute", "this.execute", 7], ["asyncMethod", "this.asyncMethod", 7],
    ["value", "this.value", 7], ["escaped", "this.escaped", 7],
    ["assigned", "this.assigned", 7], ["literal-method", "this['literal-method']", 8],
    ["literal-field", "this['literal-field']", 8]
  ]) {
    const native = nativeDefinitionTargets(service, filePath, source.indexOf(reference, start) + offset);
    const extension = resolve(memberName).map(({ filePath, range }) => ({ filePath, range }));
    assert(native.length > 0, `Native target missing for ${memberName}`);
    assert(native.some(({ filePath, range }) =>
      JSON.stringify({ filePath, range }) === JSON.stringify(extension[0])), memberName);
  }
});

test("FIX-04: imported and reexported members retain exact ranges through module traversal", (context) => {
  const graph = "scenarios/static/module-identities/classes/import-and-reexport-alias-chain";
  const file = fixtureGraph(context, graph);
  const sourceCode = fixtureSource(`${graph}/subject.js`);
  const [origin] = resolveMemberOrigins({
    filePath: file("subject.js"), sourceCode, memberName: "execute",
    line: sourceLine(sourceCode, "this.execute"), includeMemberRanges: true
  });
  assert.equal(origin.filePath, file("root.js"));
  assert.equal(rangeText(origin.filePath, origin.range), "execute");
});

test("FIX-04: ranges follow unsaved source and preserve factory-only member navigation", () => {
  const shifted = source.replace("  execute() {}", "  /* moved */ execute() {}");
  const [origin] = resolve("execute", "inspectDirect()", shifted);
  assert.equal(origin.range.start.character, 14);
  const [factory] = resolve("factoryMethod", "this.execute");
  assert.equal(rangeText(factory.filePath, factory.range), "factoryMethod");
});
