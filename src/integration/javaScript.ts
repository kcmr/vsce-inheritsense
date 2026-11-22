import type * as vscode from "vscode";

export const JS_SELECTOR: vscode.DocumentSelector = [
  { language: "javascript", scheme: "file" }
];

export function isSupportedJsFile(fileName: string): boolean {
  return fileName.endsWith(".js") || fileName.endsWith(".mjs") || fileName.endsWith(".cjs");
}

export function symbolAtPosition(
  document: vscode.TextDocument,
  position: vscode.Position
): { symbol: string; range: vscode.Range } | null {
  const range = document.getWordRangeAtPosition(position);
  if (!range) {
    return null;
  }
  const symbol = document.getText(range).trim();
  return symbol ? { symbol, range } : null;
}
