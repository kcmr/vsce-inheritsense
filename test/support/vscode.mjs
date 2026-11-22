import path from "node:path";
import { pathToFileURL } from "node:url";

class Position {
  constructor(line, character) { Object.assign(this, { line, character }); }
}
class Range {
  constructor(start, end) { Object.assign(this, { start, end }); }
}
class MarkdownString {
  constructor() { this.calls = []; }
  appendMarkdown(value) { this.calls.push(["markdown", value]); return this; }
  appendText(value) { this.calls.push(["text", value]); return this; }
  appendCodeblock(value, language) { this.calls.push(["code", value, language]); return this; }
}
class Hover {
  constructor(contents, range) { Object.assign(this, { contents, range }); }
}
class Location {
  constructor(uri, range) {
    this.uri = uri;
    this.range = range instanceof Position ? new Range(range, range) : range;
  }
}
class CompletionItem {
  constructor(label, kind) { Object.assign(this, { label, kind }); }
}
const Uri = { file: (fsPath) => ({ fsPath, scheme: "file", toString: () => pathToFileURL(fsPath).href }) };
const state = {};
function reset() {
  Object.assign(state, {
    folders: [], settings: new Map(), providers: {}, registrations: [],
    quickPick: null, pickIndex: undefined, opened: [], shown: [], messages: [],
    definitionQuery: async () => [], definitionQueries: 0
  });
  window.activeTextEditor = undefined;
}
function register(kind, selector, provider, ...triggers) {
  state.providers[kind] = provider;
  state.registrations.push({ kind, selector, triggers });
  return { dispose() {} };
}
function getWorkspaceFolder(uri) {
  return state.folders
    .filter((folder) => uri.fsPath === folder.uri.fsPath || uri.fsPath.startsWith(folder.uri.fsPath + path.sep))
    .sort((a, b) => b.uri.fsPath.length - a.uri.fsPath.length)[0];
}
const workspace = {
  get workspaceFolders() { return state.folders; },
  getWorkspaceFolder,
  getConfiguration(section, resource) {
    return { get(key, fallback) {
      const values = state.settings.get(resource?.fsPath) ?? {};
      return values[`${section}.${key}`] ?? fallback;
    } };
  },
  async openTextDocument(filePath) { state.opened.push(filePath); return { fileName: filePath }; }
};
const window = {
  async showQuickPick(items, options) {
    state.quickPick = { items, options };
    return items[state.pickIndex];
  },
  async showTextDocument(document, options) { state.shown.push({ document, options }); },
  showInformationMessage(message) { state.messages.push(["information", message]); },
  showWarningMessage(message) { state.messages.push(["warning", message]); }
};
const languages = {
  registerHoverProvider: (...args) => register("hover", ...args),
  registerDefinitionProvider: (...args) => register("definition", ...args),
  registerCompletionItemProvider: (...args) => register("completion", ...args)
};
const commands = {
  async executeCommand(command, ...args) {
    if (command !== "vscode.executeDefinitionProvider") throw new Error(`Unexpected command: ${command}`);
    state.definitionQueries += 1;
    return state.definitionQuery(...args);
  }
};
const CompletionItemKind = { Method: 1, Property: 9 };
reset();
export {
  Position, Range, MarkdownString, Hover, Location, CompletionItem, Uri,
  CompletionItemKind, workspace, window, languages, commands,
  state, reset
};

export default {
  Position, Range, MarkdownString, Hover, Location, CompletionItem, Uri,
  CompletionItemKind, workspace, window, languages, commands,
  state, reset
};
