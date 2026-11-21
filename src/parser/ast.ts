import { parse } from "@babel/parser";
import type { File } from "@babel/types";

export function parseJavaScript(sourceCode: string, filePath: string): File {
  return parse(sourceCode, {
    sourceType: "module",
    sourceFilename: filePath,
    errorRecovery: true,
    plugins: [
      "classProperties",
      "classPrivateProperties",
      "classPrivateMethods",
      "decorators-legacy",
      "dynamicImport",
      "importMeta",
      "optionalChaining",
      "nullishCoalescingOperator",
      "objectRestSpread"
    ]
  });
}
