import * as vscode from "vscode";

export function rangeForLine(line: number): vscode.Range {
  const targetLine = Math.max(0, line - 1);
  return new vscode.Range(
    new vscode.Position(targetLine, 0),
    new vscode.Position(targetLine, 0)
  );
}
