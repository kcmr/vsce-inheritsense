import * as path from "node:path";
import * as vscode from "vscode";

export function workspaceRelativePath(filePath: string): string {
  const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
  return folder ? path.relative(folder.uri.fsPath, filePath) || filePath : filePath;
}
