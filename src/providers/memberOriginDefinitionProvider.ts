import * as vscode from "vscode";
import { JS_SELECTOR, isSupportedJsFile, symbolAtPosition } from "../integration/javaScript";
import { documentResolutionInput } from "../integration/resolution";
import { resolveMemberOrigins } from "../resolver/memberResolver";
import { definitionLocation, omitNativeDefinitions } from "./definitionTargets";

export function registerMemberOriginDefinitionProvider(): vscode.Disposable {
  const nativeQueries = new Set<string>();
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
          memberName: symbol,
          includeMemberRanges: true
        });

        if (origins.length === 0) {
          return undefined;
        }

        return omitNativeDefinitions(document, position, origins.map(definitionLocation), nativeQueries);
      } catch {
        return undefined;
      }
    }
  });
}
