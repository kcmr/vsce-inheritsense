import * as vscode from "vscode";
import { isPermissiveMethodAssignedFieldsEnabled } from "../config/settings";
import { resolveMemberOrigins } from "../resolver/memberResolver";
import { showOriginQuickPick } from "../ui/quickPick";
import { rangeForLine } from "../utils/range";

function getSelectedSymbol(editor: vscode.TextEditor): string | null {
  const selection = editor.selection;
  if (!selection.isEmpty) {
    const text = editor.document.getText(selection).trim();
    return text.length > 0 ? text : null;
  }

  const wordRange = editor.document.getWordRangeAtPosition(selection.active);
  if (!wordRange) {
    return null;
  }

  const text = editor.document.getText(wordRange).trim();
  return text.length > 0 ? text : null;
}

export async function traceMemberOrigin(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage("No active editor found.");
    return;
  }

  const fileName = editor.document.fileName;
  if (!(fileName.endsWith(".js") || fileName.endsWith(".mjs") || fileName.endsWith(".cjs"))) {
    vscode.window.showInformationMessage("InheritSense currently supports JavaScript files (.js, .mjs, .cjs).");
    return;
  }

  const symbol = getSelectedSymbol(editor);
  if (!symbol) {
    vscode.window.showInformationMessage("Select a symbol name or place the cursor on it.");
    return;
  }

  const line = editor.selection.active.line + 1;
  const sourceCode = editor.document.getText();

  let origins;
  try {
    origins = resolveMemberOrigins({
      filePath: fileName,
      sourceCode,
      memberName: symbol,
      line,
      includeMethodAssignedFields: isPermissiveMethodAssignedFieldsEnabled(editor.document.uri)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parser error";
    vscode.window.showWarningMessage(`Could not resolve member origin: ${message}`);
    return;
  }

  if (origins.length === 0) {
    vscode.window.showInformationMessage("No origin found. Pattern may be unsupported in MVP.");
    return;
  }

  const selected = await showOriginQuickPick(origins);
  if (!selected) {
    return;
  }

  const document = await vscode.workspace.openTextDocument(selected.filePath);
  const targetRange = rangeForLine(selected.line);
  await vscode.window.showTextDocument(document, {
    selection: targetRange,
    preview: false
  });
}
