import * as fs from "node:fs";
import * as vscode from "vscode";
import { JS_SELECTOR, isSupportedJsFile, symbolAtPosition } from "../integration/javaScript";
import { documentResolutionInput } from "../integration/resolution";
import { workspaceRelativePath } from "../integration/workspacePaths";
import { resolveMemberOrigins } from "../resolver/memberResolver";
import { appendFormattedJsDoc, getOriginJsDoc } from "./jsDoc";

function getOriginLineSnippet(
  filePath: string,
  line: number,
  fileCache: Map<string, string[]>
): string | null {
  if (line <= 0) {
    return null;
  }

  let lines = fileCache.get(filePath);
  if (!lines) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      lines = content.split(/\r?\n/);
      fileCache.set(filePath, lines);
    } catch {
      return null;
    }
  }

  const snippet = lines[line - 1];
  if (!snippet) {
    return null;
  }

  const normalized = snippet.trimStart();
  return normalized.length > 0 ? normalized : null;
}

function createHoverMarkdown(symbol: string, origins: ReturnType<typeof resolveMemberOrigins>): vscode.MarkdownString {
  const markdown = new vscode.MarkdownString(undefined, true);
  markdown.supportHtml = false;
  markdown.isTrusted = false;
  markdown.appendMarkdown(`**InheritSense** for \`${symbol}\`\n\n`);
  const fileCache = new Map<string, string[]>();

  for (const origin of origins) {
    markdown.appendMarkdown(
      `- \`${origin.memberName}\` (${origin.kind}) - **${origin.ownerName}** [${origin.confidence}]\\
${workspaceRelativePath(origin.filePath)}:${origin.line}${origin.notes ? ` - ${origin.notes}` : ""}\n`
    );

    const snippet = getOriginLineSnippet(origin.filePath, origin.line, fileCache);
    const jsDocLines = getOriginJsDoc(origin.filePath, origin.line, fileCache);

    if (jsDocLines) {
      appendFormattedJsDoc(markdown, jsDocLines);
    }

    if (snippet) {
      markdown.appendCodeblock(snippet, "javascript");
      markdown.appendMarkdown("\n");
    }
  }

  return markdown;
}

export function registerMemberOriginHoverProvider(): vscode.Disposable {
  return vscode.languages.registerHoverProvider(JS_SELECTOR, {
    provideHover(document, position) {
      if (!isSupportedJsFile(document.fileName)) {
        return undefined;
      }

      const selected = symbolAtPosition(document, position);
      if (!selected) {
        return undefined;
      }
      const { symbol, range } = selected;

      try {
        const origins = resolveMemberOrigins({
          ...documentResolutionInput(document, position, { includeCurrentClass: false }),
          memberName: symbol
        });

        if (origins.length === 0) {
          return undefined;
        }

        return new vscode.Hover(createHoverMarkdown(symbol, origins), range);
      } catch {
        return undefined;
      }
    }
  });
}
