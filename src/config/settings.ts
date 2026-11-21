import * as vscode from "vscode";

export function isInheritedCompletionEnabled(resource?: vscode.Uri): boolean {
  const config = vscode.workspace.getConfiguration("inheritSense", resource);
  return config.get<boolean>("completion.enableInheritedSuggestions", true);
}

export function isPermissiveMethodAssignedFieldsEnabled(resource?: vscode.Uri): boolean {
  const config = vscode.workspace.getConfiguration("inheritSense", resource);
  return config.get<boolean>("resolution.includeMethodAssignedFields", false);
}
