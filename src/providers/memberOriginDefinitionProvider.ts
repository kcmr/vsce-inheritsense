import * as vscode from "vscode";
import { isPermissiveMethodAssignedFieldsEnabled } from "../config/settings";
import { resolveMemberOrigins } from "../resolver/memberResolver";

const JS_SELECTOR: vscode.DocumentSelector = [
  { language: "javascript", scheme: "file" }
];

function isSupportedJsFile(fileName: string): boolean {
  return fileName.endsWith(".js") || fileName.endsWith(".mjs") || fileName.endsWith(".cjs");
}

export function registerMemberOriginDefinitionProvider(): vscode.Disposable {
  return vscode.languages.registerDefinitionProvider(JS_SELECTOR, {
    provideDefinition(document, position) {
      if (!isSupportedJsFile(document.fileName)) {
        return undefined;
      }

      const wordRange = document.getWordRangeAtPosition(position);
      if (!wordRange) {
        return undefined;
      }

      const symbol = document.getText(wordRange).trim();
      if (!symbol) {
        return undefined;
      }

      try {
        const origins = resolveMemberOrigins({
          filePath: document.fileName,
          sourceCode: document.getText(),
          memberName: symbol,
          line: position.line + 1,
          includeCurrentClass: false,
          includeMethodAssignedFields: isPermissiveMethodAssignedFieldsEnabled(document.uri)
        });

        if (origins.length === 0) {
          return undefined;
        }

        return origins.map((origin) => {
          const targetUri = vscode.Uri.file(origin.filePath);
          const targetPosition = new vscode.Position(Math.max(0, origin.line - 1), 0);
          return new vscode.Location(targetUri, targetPosition);
        });
      } catch {
        return undefined;
      }
    }
  });
}
