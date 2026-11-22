import type * as vscode from "vscode";
import { isPermissiveMethodAssignedFieldsEnabled } from "../config/settings";

interface DocumentResolutionOptions {
  includeCurrentClass?: boolean;
  sourceCode?: string;
}

export function documentResolutionInput(
  document: vscode.TextDocument,
  position: vscode.Position,
  options: DocumentResolutionOptions = {}
) {
  return {
    filePath: document.fileName,
    sourceCode: options.sourceCode ?? document.getText(),
    line: position.line + 1,
    includeCurrentClass: options.includeCurrentClass,
    includeMethodAssignedFields: isPermissiveMethodAssignedFieldsEnabled(document.uri)
  };
}
