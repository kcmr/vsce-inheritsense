import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { URL } from "node:url";
import { beforeEach, test } from "node:test";
import vscode from "./support/vscode.mjs";
import { fixtureGraph, fixturePath, fixtureSource, sourceLine } from "./helpers.mjs";
import { positionOf, textDocument } from "./support/documents.mjs";
import { nativeDefinitionService, nativeDefinitionTargets } from "./support/native-definitions.mjs";

// Only the VS Code boundary is doubled; providers use the real parser/resolver.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "vscode") {
      return { url: new URL("./support/vscode.mjs", import.meta.url).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  }
});
const { JS_SELECTOR, isSupportedJsFile, symbolAtPosition } = await import("../dist/integration/javaScript.js");
const { documentResolutionInput } = await import("../dist/integration/resolution.js");
const { workspaceRelativePath } = await import("../dist/integration/workspacePaths.js");
const { registerMemberOriginHoverProvider } = await import("../dist/providers/memberOriginHoverProvider.js");
const { registerMemberOriginDefinitionProvider } = await import("../dist/providers/memberOriginDefinitionProvider.js");
const { registerMemberOriginCompletionProvider } = await import("../dist/providers/memberOriginCompletionProvider.js");
const { showOriginQuickPick } = await import("../dist/ui/quickPick.js");
const { traceMemberOrigin } = await import("../dist/commands/traceMemberOrigin.js");
const { state, Uri, Position, Range } = vscode;
const fixtureRoot = "scenarios/static/integration/workspace";
beforeEach(() => vscode.reset());

function setup(context, sourceOverride) {
  const file = fixtureGraph(context, fixtureRoot);
  state.folders = ["first", "second"].map((name) => ({ name, uri: Uri.file(file(name)) }));
  const source = sourceOverride ?? readFileSync(file("second/subject.js"), "utf8");
  const document = textDocument(file("second/subject.js"), source);
  registerMemberOriginHoverProvider();
  registerMemberOriginDefinitionProvider();
  registerMemberOriginCompletionProvider();
  return { file, source, document, position: positionOf(source, "this.execute", 7) };
}
function markdownText(markdown) { return markdown.calls.map(([, value]) => value).join(""); }
function origin(filePath, ownerName = "Root") {
  return { filePath, ownerName, line: 3, memberName: "execute", kind: "method", confidence: "high" };
}
function setEditor(document, position, selection) {
  vscode.window.activeTextEditor = {
    document,
    selection: selection ?? { isEmpty: true, active: position }
  };
}

test("REF-04: resource-read settings permit folder overrides in the manifest", () => {
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const properties = manifest.contributes.configuration.properties;
  for (const name of ["completion.enableInheritedSuggestions", "resolution.includeMethodAssignedFields"]) {
    assert.equal(properties[`inheritSense.${name}`].scope, "resource", name);
  }
});

test("REF-04: providers share file-only JavaScript registration and completion trigger", (context) => {
  setup(context);
  assert.deepEqual(JS_SELECTOR, [{ language: "javascript", scheme: "file" }]);
  assert.equal(state.registrations.length, 3);
  for (const registration of state.registrations) assert.strictEqual(registration.selector, JS_SELECTOR);
  assert.deepEqual(state.registrations[2].triggers, ["."]);
  for (const extension of [".js", ".mjs", ".cjs"]) assert(isSupportedJsFile(`subject${extension}`));
  for (const extension of [".ts", ".jsx", ".JS", ".js.map"]) assert(!isSupportedJsFile(`subject${extension}`));
});

test("REF-04: shared symbol extraction preserves range, trimming, and absent/blank words", (context) => {
  const { document, position } = setup(context);
  const selected = symbolAtPosition(document, position);
  assert.equal(selected.symbol, "execute");
  assert.equal(document.getText(selected.range), "execute");
  assert.equal(symbolAtPosition(document, new Position(0, 0))?.symbol, "import");
  assert.equal(symbolAtPosition({ getWordRangeAtPosition: () => undefined }, position), null);
  assert.equal(symbolAtPosition({ getWordRangeAtPosition: () => new Range(position, position), getText: () => "  " }, position), null);
});

test("REF-04: resolution input reads current source, scoped settings, one-based line, and caller policy", (context) => {
  const { document, position, source } = setup(context);
  state.settings.set(document.uri.fsPath, { "inheritSense.resolution.includeMethodAssignedFields": true });
  assert.deepEqual(documentResolutionInput(document, position), {
    filePath: document.fileName, sourceCode: source, line: position.line + 1,
    includeCurrentClass: undefined, includeMethodAssignedFields: true
  });
  const input = documentResolutionInput(document, position, { includeCurrentClass: false, sourceCode: "" });
  assert.equal(input.sourceCode, "");
  assert.equal(input.includeCurrentClass, false);
});

test("REF-04: paths use the containing root, retain external paths, and support nested/no roots", (context) => {
  const { file } = setup(context);
  assert.equal(workspaceRelativePath(file("first/root.js")), "root.js");
  assert.equal(workspaceRelativePath(file("second/subject.js")), "subject.js");
  assert.equal(workspaceRelativePath(file("external/root.js")), file("external/root.js"));
  assert.equal(workspaceRelativePath(file("second")), file("second"));
  state.folders.push({ uri: Uri.file(file("second/nested")) });
  assert.equal(workspaceRelativePath(file("second/nested/root.js")), "root.js");
  assert.equal(workspaceRelativePath(file("second-sibling/root.js")), file("second-sibling/root.js"));
  state.folders = [];
  assert.equal(workspaceRelativePath(file("first/root.js")), file("first/root.js"));
});

test("REF-04: Quick Pick formats each origin against its own root and preserves selection/cancel", async (context) => {
  const { file } = setup(context);
  const origins = [origin(file("first/root.js")), origin(file("second/subject.js")), origin(file("external/root.js"))];
  state.pickIndex = 1;
  assert.strictEqual(await showOriginQuickPick(origins), origins[1]);
  assert.deepEqual(state.quickPick.items.map((item) => item.detail), ["root.js:3", "subject.js:3", `${file("external/root.js")}:3`]);
  assert.equal(state.quickPick.items[0].label, "execute (method)");
  assert.equal(state.quickPick.items[0].description, "Root [high]");
  state.pickIndex = undefined;
  assert.equal(await showOriginQuickPick(origins), null);
});

test("REF-04: hover and definition retain inherited origins, range, JSDoc, and local exclusion", async (context) => {
  const { document, position, file, source } = setup(context);
  const hover = state.providers.hover.provideHover(document, position);
  assert.match(markdownText(hover.contents), /root\.js:3/);
  assert.match(markdownText(hover.contents), /Execute the inherited action/);
  assert.equal(document.getText(hover.range), "execute");
  assert.equal(hover.contents.isTrusted, false);
  assert.equal(hover.contents.supportHtml, false);
  const [definition] = await state.providers.definition.provideDefinition(document, position);
  assert.equal(definition.uri.fsPath, file("first/root.js"));
  assert.equal(definition.range.start.line, 2);
  const own = positionOf(source, "this.own", 6);
  assert.equal(state.providers.hover.provideHover(document, own), undefined);
  assert.equal(await state.providers.definition.provideDefinition(document, own), undefined);
});

test("REF-04: lookup providers ignore unsupported files and absent symbols, and contain parse failures", async (context) => {
  const { document, position, source } = setup(context);
  const invalid = fixtureSource("scenarios/malformed/parser/unrecoverable-syntax/invalid.js");
  for (const provider of [state.providers.hover.provideHover, state.providers.definition.provideDefinition]) {
    assert.equal(await provider(textDocument("subject.ts", source), position), undefined);
    assert.equal(await provider({ ...document, getWordRangeAtPosition: () => undefined }, position), undefined);
    assert.equal(await provider({ ...document, getText: (range) => range ? "execute" : invalid }, position), undefined);
  }
});

test("REF-04: providers respect strict/permissive resource settings and completion filtering", async (context) => {
  const { document, source } = setup(context);
  const position = positionOf(source, "this.dynamic", 8);
  assert.equal(state.providers.hover.provideHover(document, position), undefined);
  const completion = state.providers.completion.provideCompletionItems;
  assert(!completion(document, position).some((item) => item.label === "dynamic"));
  state.settings.set(document.uri.fsPath, { "inheritSense.resolution.includeMethodAssignedFields": true });
  assert(state.providers.hover.provideHover(document, position));
  assert.equal((await state.providers.definition.provideDefinition(document, position)).length, 1);
  const items = completion(document, position);
  assert(items.some((item) => item.label === "dynamic"));
  assert(!items.some((item) => item.label === "own"));
  const execute = items.find((item) => item.label === "execute");
  assert.equal(execute.detail, "method from Root");
  assert.match(markdownText(execute.documentation), /root\.js:3/);
  state.settings.set(document.uri.fsPath, { "inheritSense.completion.enableInheritedSuggestions": false });
  assert.equal(completion(document, position), undefined);
});

test("REF-04: completion repairs an unsaved trailing this-dot and rejects unrelated contexts", (context) => {
  const { document, source, position } = setup(context);
  const completion = state.providers.completion.provideCompletionItems;
  const changed = source.replace("this.execute", "this.");
  const unsaved = textDocument(document.fileName, changed);
  const cursor = positionOf(changed, "this.", 5);
  assert(completion(unsaved, cursor).some((item) => item.label === "execute"));
  assert.equal(completion(textDocument("subject.ts", source), position), undefined);
  assert.equal(completion(document, positionOf(source, "inspect", 3)), undefined);
});

test("REF-04: trace keeps selected-text precedence, local origins, and navigation", async (context) => {
  const { document, source, file } = setup(context);
  const position = positionOf(source, "this.execute", 7);
  const selectedPosition = positionOf(source, "this.own", 5);
  const selectedRange = new Range(selectedPosition, new Position(selectedPosition.line, selectedPosition.character + 3));
  setEditor(document, position, { ...selectedRange, isEmpty: false, active: position });
  state.pickIndex = 0;
  await traceMemberOrigin();
  assert.equal(state.quickPick.items[0].origin.memberName, "own");
  assert.equal(state.quickPick.items[0].detail, "subject.js:3 - member in current class");
  assert.deepEqual(state.opened, [file("second/subject.js")]);
  assert.equal(state.shown[0].options.preview, false);
  assert.equal(state.shown[0].options.selection.start.line, sourceLine(source, "own()") - 1);
});

test("REF-04: trace falls back to the cursor, respects cancellation, and reports missing editor", async (context) => {
  await traceMemberOrigin();
  assert.equal(state.messages[0][1], "No active editor found.");
  const { document, position } = setup(context);
  setEditor(document, position);
  await traceMemberOrigin();
  assert.equal(state.quickPick.items[0].origin.memberName, "execute");
  assert.deepEqual(state.opened, []);
});

test("FIX-04: definitions select the declaration identifier instead of a column-zero point", async (context) => {
  const { document, position } = setup(context);
  const [definition] = await state.providers.definition.provideDefinition(document, position);
  assert.deepEqual(definition.range, new Range(new Position(2, 2), new Position(2, 9)));
});

test("FIX-04: native selection ranges suppress duplicate targets and recursive probes terminate", async (context) => {
  const { document, position, file } = setup(context);
  const selection = new Range(new Position(2, 2), new Position(2, 9));
  state.definitionQuery = async () => {
    const nested = await state.providers.definition.provideDefinition(document, position);
    assert.deepEqual(nested[0].range, selection);
    return [
      { targetUri: nested[0].uri, targetRange: nested[0].range },
      { targetUri: Uri.file(file("first/root.js")), targetRange: new Range(new Position(2, 2), new Position(2, 14)), targetSelectionRange: selection }
    ];
  };
  assert.equal(await state.providers.definition.provideDefinition(document, position), undefined);
  assert.equal(state.definitionQueries, 1);
});

test("FIX-04: a different declaration in the same file is retained and failed probes preserve fallback", async (context) => {
  const { document, position, file } = setup(context);
  state.definitionQuery = async () => [{
    targetUri: Uri.file(file("first/root.js")),
    targetRange: new Range(new Position(3, 2), new Position(3, 8)),
    targetSelectionRange: new Range(new Position(3, 2), new Position(3, 8))
  }];
  assert.equal((await state.providers.definition.provideDefinition(document, position)).length, 1);
  state.definitionQuery = async () => { throw new Error("native lookup failed"); };
  assert.equal((await state.providers.definition.provideDefinition(document, position)).length, 1);
  state.definitionQuery = async () => [];
  assert.equal((await state.providers.definition.provideDefinition(document, position)).length, 1);
  assert.equal(state.definitionQueries, 3);
});

test("FIX-04: the real TypeScript context/selection pair is preferred without losing injector fallback", async (context) => {
  const { document, position, file, source } = setup(context);
  const service = nativeDefinitionService(context, [document.fileName, file("first/root.js")]);
  const offset = source.indexOf("this.execute") + 7;
  const native = nativeDefinitionTargets(service, document.fileName, offset);
  assert.equal(native.length, 1);
  assert.notDeepEqual(native[0].contextRange, native[0].range);
  state.definitionQuery = async () => {
    const nested = await state.providers.definition.provideDefinition(document, position);
    return [
      ...nested.map((location) => ({ targetUri: location.uri, targetRange: location.range })),
      ...native.map((target) => ({ targetUri: Uri.file(target.filePath), targetRange: target.contextRange, targetSelectionRange: target.range }))
    ];
  };
  assert.equal(await state.providers.definition.provideDefinition(document, position), undefined);
  state.definitionQuery = async () => [];
  const injectionSource = fixtureSource("scenarios/static/definition-ranges/subject.js");
  const injectionDocument = textDocument(fixturePath("scenarios/static/definition-ranges/subject.js"), injectionSource);
  const [injected] = await state.providers.definition.provideDefinition(injectionDocument, positionOf(injectionSource, "this.injected", 7));
  assert(injected.range.start.character > 0);
});

test("FIX-04: native equivalence removes only one of two real declarations on the same file line", async () => {
  registerMemberOriginDefinitionProvider();
  const source = fixtureSource("scenarios/static/definition-ranges/subject.js");
  const document = textDocument(fixturePath("scenarios/static/definition-ranges/subject.js"), source);
  const position = positionOf(source, "this.same", 7);
  let first;
  state.definitionQuery = async () => {
    const nested = await state.providers.definition.provideDefinition(document, position);
    assert.equal(nested.length, 2);
    first = nested[0].range;
    assert.equal(first.start.line, nested[1].range.start.line);
    return [{ targetUri: nested[0].uri, targetRange: first, targetSelectionRange: first }];
  };
  const remaining = await state.providers.definition.provideDefinition(document, position);
  assert.equal(remaining.length, 1);
  assert.notDeepEqual(remaining[0].range, first);
});
