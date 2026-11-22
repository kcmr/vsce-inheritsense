import * as vscode from "vscode";
import { JS_SELECTOR, isSupportedJsFile, symbolAtPosition } from "../integration/javaScript";
import { documentResolutionInput } from "../integration/resolution";
import { resolveMemberOrigins } from "../resolver/memberResolver";

export function registerMemberOriginDefinitionProvider(): vscode.Disposable {
  return vscode.languages.registerDefinitionProvider(JS_SELECTOR, {
    provideDefinition(document, position) {
      if (!isSupportedJsFile(document.fileName)) {
        return undefined;
      }

      const selected = symbolAtPosition(document, position);
      if (!selected) {
        return undefined;
      }
      const { symbol } = selected;

      try {
        const origins = resolveMemberOrigins({
          ...documentResolutionInput(document, position, { includeCurrentClass: false }),
          memberName: symbol
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
