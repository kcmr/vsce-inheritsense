import assert from "node:assert/strict";
import { test } from "node:test";
import { extractFileSymbols } from "../dist/parser/symbols.js";
import { resolveMemberOrigins, resolveInheritedMemberCatalog } from "../dist/resolver/memberResolver.js";
import { assertOrigin, documentInput, fixtureGraph, fixtureSource } from "./helpers.mjs";

test("FIX-01: constructor discovery respects nested function/class scopes and lexical arrows", () => {
  const source = fixtureSource("scenarios/static/regressions/constructor-discovery-respects-nested-function-class-scopes-and-lexical-arrows/subject.js");
  const members = extractFileSymbols(source, "example.js").classes[0].members;
  assert.deepEqual(members.map((member) => member.name).sort(), ["lexical", "own"]);
});

for (const includeMethodAssignedFields of [false, true]) {
  test(`FIX-01: assignment scopes in ${includeMethodAssignedFields ? "permissive" : "strict"} mode`, () => {
    const source = fixtureSource(`scenarios/static/regressions/assignment-scopes-${includeMethodAssignedFields ? "permissive" : "strict"}/subject.js`);
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
  const file = fixtureGraph(context, "scenarios/static/regressions/injector-calls-keep-lexical-this-and-exclude-foreign-scopes-in-lookup-and-catalog");
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
    const file = fixtureGraph(context, "scenarios/static/regressions/lookup-and-catalog-traverses-all-local-ancestors");
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
    const file = fixtureGraph(context, `scenarios/static/regressions/providers-${imported ? "imported" : "local"}`);
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
  const file = fixtureGraph(context, "scenarios/static/regressions/local-recursion-uses-the-current-document-source-before-saving");
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
  const file = fixtureGraph(context, "scenarios/static/regressions/nearest-declarations-and-injectors-precede-ancestor-origins");
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
  const file = fixtureGraph(context, "scenarios/static/regressions/deep-ancestors-preserve-injectors-and-strict-permissive-assignment-discovery");
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
    const file = fixtureGraph(context, `scenarios/static/regressions/cycles-${cycle}`);
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
    const file = fixtureGraph(context, `scenarios/static/regressions/aliases-${mode}`);
    const input = documentInput(file("subject.js"), "inspect()");
    const origins = resolveMemberOrigins({ ...input, memberName: "execute" });
    assert.equal(origins.length, 1);
    assert.equal(origins[0].ownerName, "Root");
    assert.equal(origins[0].filePath, file("root.js"));
  });
}
