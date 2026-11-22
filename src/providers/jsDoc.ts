import type { MarkdownString } from "vscode";

type JsDocMarkdown = Pick<MarkdownString, "appendText" | "appendMarkdown">;

export function getOriginJsDoc(
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
  const start = findJsDocStart(lines, cursor);
  if (start < 0) {
    return null;
  }

  return cleanJsDoc(lines.slice(start, end + 1));
}

function findJsDocStart(lines: string[], cursor: number): number {
  while (cursor >= 0) {
    const currentLine = lines[cursor];
    if (currentLine.includes("/**")) {
      return cursor;
    }
    if (currentLine.includes("/*") && !currentLine.includes("/**")) {
      return -1;
    }
    cursor -= 1;
  }

  return -1;
}

function cleanJsDoc(rawBlock: string[]): string[] | null {
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

export function appendFormattedJsDoc(markdown: JsDocMarkdown, jsDocLines: string[]): void {
  const { summaryLines, tagLines } = splitJsDoc(jsDocLines);

  const summary = summaryLines.join("\n").trim();
  if (summary.length > 0) {
    markdown.appendText(summary);
    markdown.appendMarkdown("\n\n");
  }

  for (const tagLine of tagLines) {
    appendTag(markdown, tagLine);
  }

  if (tagLines.length > 0) {
    markdown.appendMarkdown("\n");
  }
}

function splitJsDoc(jsDocLines: string[]): { summaryLines: string[]; tagLines: string[] } {
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

  return { summaryLines, tagLines };
}

function appendTag(markdown: JsDocMarkdown, tagLine: string): void {
  const paramMatch = tagLine.match(/^@param\s+(?:\{([^}]+)\}\s*)?([^\s-]+)\s*(?:-\s*)?(.*)$/);
  if (paramMatch) {
    appendParamTag(markdown, paramMatch);
    return;
  }

  const returnsMatch = tagLine.match(/^@returns?\s+(?:\{([^}]+)\}\s*)?(.*)$/);
  if (returnsMatch) {
    appendReturnsTag(markdown, returnsMatch);
    return;
  }

  const deprecatedMatch = tagLine.match(/^@deprecated\s*(.*)$/);
  if (deprecatedMatch) {
    const description = deprecatedMatch[1]?.trim();
    markdown.appendMarkdown(`- **@deprecated**${description ? ` - ${description}` : ""}\n`);
    return;
  }

  const genericTag = tagLine.match(/^@([^\s]+)\s*(.*)$/);
  if (genericTag) {
    const tagName = genericTag[1];
    const description = genericTag[2]?.trim();
    markdown.appendMarkdown(`- **@${tagName}**${description ? ` - ${description}` : ""}\n`);
    return;
  }

  markdown.appendText(tagLine);
  markdown.appendMarkdown("\n");
}

function appendParamTag(markdown: JsDocMarkdown, match: RegExpMatchArray): void {
  const typeText = match[1] ? ` {\`${match[1]}\`}` : "";
  const name = match[2];
  const description = match[3]?.trim();
  markdown.appendMarkdown(`- **@param** \`${name}\`${typeText}${description ? ` - ${description}` : ""}\n`);
}

function appendReturnsTag(markdown: JsDocMarkdown, match: RegExpMatchArray): void {
  const typeText = match[1] ? ` {\`${match[1]}\`}` : "";
  const description = match[2]?.trim();
  markdown.appendMarkdown(`- **@returns**${typeText}${description ? ` - ${description}` : ""}\n`);
}
