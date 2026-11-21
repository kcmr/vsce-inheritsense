import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { isPermissiveMethodAssignedFieldsEnabled } from "../config/settings";
import { resolveMemberOrigins } from "../resolver/memberResolver";

const JS_SELECTOR: vscode.DocumentSelector = [
  { language: "javascript", scheme: "file" }
];

function isSupportedJsFile(fileName: string): boolean {
  return fileName.endsWith(".js") || fileName.endsWith(".mjs") || fileName.endsWith(".cjs");
}

function toRelativePath(filePath: string): string {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
  if (!workspaceFolder) {
    return filePath;
  }

  return path.relative(workspaceFolder.uri.fsPath, filePath) || filePath;
}

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

function getOriginJsDoc(
  filePath: string,
  line: number,
  fileCache: Map<string, string[]>
): string[] | null {
  if (line <= 1) {
    return null;
  }

  const lines = fileCache.get(filePath);
  if (!lines) {
    return null;
  }

  let cursor = line - 2;
  while (cursor >= 0 && lines[cursor].trim() === "") {
    cursor -= 1;
  }

  if (cursor < 0 || !lines[cursor].includes("*/")) {
    return null;
  }

  const end = cursor;
  let start = -1;
  while (cursor >= 0) {
    const currentLine = lines[cursor];
    if (currentLine.includes("/**")) {
      start = cursor;
      break;
    }
    if (currentLine.includes("/*") && !currentLine.includes("/**")) {
      return null;
    }
    cursor -= 1;
  }

  if (start < 0) {
    return null;
  }

  const rawBlock = lines.slice(start, end + 1);
  const cleanedLines = rawBlock.map((raw) => {
    let lineText = raw.trim();
    lineText = lineText.replace(/^\/\*\*?\s?/, "");
    lineText = lineText.replace(/^\*\s?/, "");
    lineText = lineText.replace(/\*\/$/, "");
    lineText = lineText.trim();
    if (lineText === "/") {
      return "";
    }
    return lineText;
  });

  while (cleanedLines.length > 0 && cleanedLines[0] === "") {
    cleanedLines.shift();
  }
  while (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] === "") {
    cleanedLines.pop();
  }

  if (cleanedLines.length === 0) {
    return null;
  }

  return cleanedLines;
}

function appendFormattedJsDoc(markdown: vscode.MarkdownString, jsDocLines: string[]): void {
  const summaryLines: string[] = [];
  const tagLines: string[] = [];
  let inTags = false;

  for (const line of jsDocLines) {
    if (line.startsWith("@")) {
      inTags = true;
      tagLines.push(line);
      continue;
    }

    if (!inTags) {
      summaryLines.push(line);
    } else if (line.length > 0 && tagLines.length > 0) {
      tagLines[tagLines.length - 1] += ` ${line}`;
    }
  }

  const summary = summaryLines.join("\n").trim();
  if (summary.length > 0) {
    markdown.appendText(summary);
    markdown.appendMarkdown("\n\n");
  }

  for (const tagLine of tagLines) {
    const paramMatch = tagLine.match(/^@param\s+(?:\{([^}]+)\}\s*)?([^\s-]+)\s*(?:-\s*)?(.*)$/);
    if (paramMatch) {
      const typeText = paramMatch[1] ? ` {\`${paramMatch[1]}\`}` : "";
      const name = paramMatch[2];
      const description = paramMatch[3]?.trim();
      markdown.appendMarkdown(`- **@param** \`${name}\`${typeText}${description ? ` - ${description}` : ""}\n`);
      continue;
    }

    const returnsMatch = tagLine.match(/^@returns?\s+(?:\{([^}]+)\}\s*)?(.*)$/);
    if (returnsMatch) {
      const typeText = returnsMatch[1] ? ` {\`${returnsMatch[1]}\`}` : "";
      const description = returnsMatch[2]?.trim();
      markdown.appendMarkdown(`- **@returns**${typeText}${description ? ` - ${description}` : ""}\n`);
      continue;
    }

    const deprecatedMatch = tagLine.match(/^@deprecated\s*(.*)$/);
    if (deprecatedMatch) {
      const description = deprecatedMatch[1]?.trim();
      markdown.appendMarkdown(`- **@deprecated**${description ? ` - ${description}` : ""}\n`);
      continue;
    }

    const genericTag = tagLine.match(/^@([^\s]+)\s*(.*)$/);
    if (genericTag) {
      const tagName = genericTag[1];
      const description = genericTag[2]?.trim();
      markdown.appendMarkdown(`- **@${tagName}**${description ? ` - ${description}` : ""}\n`);
      continue;
    }

    markdown.appendText(tagLine);
    markdown.appendMarkdown("\n");
  }

  if (tagLines.length > 0) {
    markdown.appendMarkdown("\n");
  }
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
${toRelativePath(origin.filePath)}:${origin.line}${origin.notes ? ` - ${origin.notes}` : ""}\n`
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

        return new vscode.Hover(createHoverMarkdown(symbol, origins), wordRange);
      } catch {
        return undefined;
      }
    }
  });
}
