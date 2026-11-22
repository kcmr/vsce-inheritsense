import assert from "node:assert/strict";
import { log } from "node:console";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";

// Resolve VS Code through the extension host's CommonJS API loader.
const load = createRequire(import.meta.url);
const vscode = load("vscode");
const { workspaceRelativePath } = load("../../dist/integration/workspacePaths.js");
const { documentResolutionInput } = load("../../dist/integration/resolution.js");
const { symbolAtPosition } = load("../../dist/integration/javaScript.js");
const root = fileURLToPath(new URL("../fixtures/scenarios/static/integration/workspace/", import.meta.url));

function positionOf(document, marker, offset = 0) {
  const index = document.getText().indexOf(marker);
  assert.notEqual(index, -1, `Missing source marker: ${marker}`);
  return document.positionAt(index + offset);
}

function hoverText(hovers) {
  return hovers.flatMap((hover) => hover.contents)
    .map((content) => typeof content === "string" ? content : content.value)
    .join("\n");
}

async function completionItems(document) {
  const result = await vscode.commands.executeCommand(
    "vscode.executeCompletionItemProvider", document.uri,
    positionOf(document, "this.execute", 5), undefined, 100
  );
  // Native JS suggestions can coexist with extension results.
  return result.items.filter((item) => item.detail?.includes(" from Root"));
}

function checkWorkspacePaths() {
  assert.equal(vscode.workspace.workspaceFolders.length, 2, "Open integration.code-workspace for these tests");
  assert.equal(workspaceRelativePath(path.join(root, "first/root.js")), "root.js");
  assert.equal(workspaceRelativePath(path.join(root, "second/subject.js")), "subject.js");
  const external = path.join(root, "external/root.js");
  assert.equal(workspaceRelativePath(external), external);
}

function checkDocumentInput(first, second) {
  const position = positionOf(second, "this.execute", 7);
  const selected = symbolAtPosition(second, position);
  assert.equal(selected.symbol, "execute");
  assert.equal(second.getText(selected.range), "execute");
  const input = documentResolutionInput(second, position, { includeCurrentClass: false });
  assert.equal(input.sourceCode, second.getText());
  assert.equal(input.line, position.line + 1);
  assert.equal(input.includeCurrentClass, false);
  assert.equal(input.includeMethodAssignedFields, true);
  assert.equal(documentResolutionInput(first, position).includeMethodAssignedFields, false);
}

async function checkLookupProviders(second) {
  const position = positionOf(second, "this.execute", 7);
  const hovers = await vscode.commands.executeCommand("vscode.executeHoverProvider", second.uri, position);
  const text = hoverText(hovers);
  assert.match(text, /\*\*InheritSense\*\*/);
  assert.match(text, /root\.js:3/);
  assert.match(text, /Execute the inherited action/);
  const definitions = await vscode.commands.executeCommand("vscode.executeDefinitionProvider", second.uri, position);
  assert(definitions.some((definition) =>
    definition.uri?.fsPath === path.join(root, "first/root.js") &&
    definition.range.start.line === 2 && definition.range.start.character === 0));
  const local = await vscode.commands.executeCommand("vscode.executeHoverProvider", second.uri, positionOf(second, "this.own", 6));
  assert.doesNotMatch(hoverText(local), /\*\*InheritSense\*\*/);
}

async function checkExternalOrigin() {
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(root, "second/external-subject.js")));
  const position = positionOf(document, "this.execute", 7);
  const hovers = await vscode.commands.executeCommand("vscode.executeHoverProvider", document.uri, position);
  assert(hoverText(hovers).includes(`${path.join(root, "external/root.js")}:2`));
  const definitions = await vscode.commands.executeCommand("vscode.executeDefinitionProvider", document.uri, position);
  assert(definitions.some((definition) =>
    definition.uri?.fsPath === path.join(root, "external/root.js") && definition.range.start.character === 0));
}

async function checkCompletionProviders(first, second) {
  const strict = await completionItems(first);
  assert(strict.some((item) => item.label === "execute"));
  assert(!strict.some((item) => item.label === "dynamic"));
  const permissive = await completionItems(second);
  assert(permissive.some((item) => item.label === "dynamic"));
  assert(!permissive.some((item) => item.label === "own"));
  const execute = permissive.find((item) => item.label === "execute");
  assert.match(execute.documentation.value, /root\.js:3/);
}

async function checkUnsavedCompletion(second) {
  const position = positionOf(second, "this.execute", 5);
  const wordRange = second.getWordRangeAtPosition(position);
  assert(wordRange, "Expected an execute identifier at the completion position");
  const original = second.getText(wordRange);
  assert.equal(original, "execute");
  const edit = new vscode.WorkspaceEdit();
  edit.replace(second.uri, wordRange, "");
  assert(await vscode.workspace.applyEdit(edit));
  try {
    const input = documentResolutionInput(second, position);
    assert.equal(input.sourceCode, second.getText());
    assert(second.isDirty);
    const result = await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider", second.uri, position, undefined, 100
    );
    assert(result.items.some((item) => item.label === "execute" && item.detail === "method from Root"));
  } finally {
    const restore = new vscode.WorkspaceEdit();
    restore.insert(second.uri, position, original);
    assert(await vscode.workspace.applyEdit(restore));
  }
}

export async function run(report = () => {}) {
  const extension = vscode.extensions.getExtension("local.inheritsense");
  assert(extension, "InheritSense must be loaded as the development extension");
  await extension.activate();
  const first = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(root, "first/subject.js")));
  const second = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(root, "second/subject.js")));
  const checks = [
    ["workspace paths", checkWorkspacePaths],
    ["resource-scoped resolution input", () => checkDocumentInput(first, second)],
    ["registered hover/definition", () => checkLookupProviders(second)],
    ["external-file origins", checkExternalOrigin],
    ["registered completion and modes", () => checkCompletionProviders(first, second)],
    ["unsaved this-dot completion", () => checkUnsavedCompletion(second)]
  ];
  for (const [name, check] of checks) {
    await check();
    const message = `REF-04 extension host: PASS ${name}`;
    log(message);
    report(message);
  }
  const summary = `REF-04 extension host: ${checks.length} checks passed`;
  log(summary);
  report(summary);
}
