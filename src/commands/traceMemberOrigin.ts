import * as vscode from "vscode";
import { isSupportedJsFile, symbolAtPosition } from "../integration/javaScript";
import { documentResolutionInput } from "../integration/resolution";
import { resolveMemberOrigins } from "../resolver/memberResolver";
import { showOriginQuickPick } from "../ui/quickPick";
import { rangeForLine } from "../utils/range";

function getSelectedSymbol(editor: vscode.TextEditor): string | null {
  const selection = editor.selection;
  if (!selection.isEmpty) {
    const text = editor.document.getText(selection).trim();
    return text.length > 0 ? text : null;
  }

  return symbolAtPosition(editor.document, selection.active)?.symbol ?? null;
}

export async function traceMemberOrigin(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage("No active editor found.");
    return;
  }

  const fileName = editor.document.fileName;
  if (!isSupportedJsFile(fileName)) {
    vscode.window.showInformationMessage("InheritSense currently supports JavaScript files (.js, .mjs, .cjs).");
    return;
  }

  const symbol = getSelectedSymbol(editor);
  if (!symbol) {
    vscode.window.showInformationMessage("Select a symbol name or place the cursor on it.");
    return;
  }

  let origins;
  try {
    origins = resolveMemberOrigins({
      ...documentResolutionInput(editor.document, editor.selection.active),
      memberName: symbol
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
