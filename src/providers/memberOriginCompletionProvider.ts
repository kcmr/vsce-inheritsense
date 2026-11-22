import * as vscode from "vscode";
import { JS_SELECTOR, isSupportedJsFile } from "../integration/javaScript";
import { documentResolutionInput } from "../integration/resolution";
import { workspaceRelativePath } from "../integration/workspacePaths";
import { isInheritedCompletionEnabled } from "../config/settings";
import { resolveInheritedMemberCatalog } from "../resolver/memberResolver";

function isThisMemberContext(document: vscode.TextDocument, position: vscode.Position): boolean {
  const linePrefix = document.lineAt(position).text.slice(0, position.character);
  return /(?:^|[^\w$])this\.[\w$]*$/.test(linePrefix);
}

function sourceForCompletionAnalysis(document: vscode.TextDocument, position: vscode.Position): string {
  const source = document.getText();
  const offset = document.offsetAt(position);
  const prefix = source.slice(0, offset);

  // Right after typing `this.` the source is temporarily invalid JS.
  // Add a synthetic identifier so the parser can still build an AST.
  if (/this\.$/.test(prefix)) {
    return `${prefix}__inheritSensePlaceholder${source.slice(offset)}`;
  }

  return source;
}

function completionItemKind(kind: "method" | "getter" | "setter" | "field"): vscode.CompletionItemKind {
  if (kind === "method") {
    return vscode.CompletionItemKind.Method;
  }
  return vscode.CompletionItemKind.Property;
}

export function registerMemberOriginCompletionProvider(): vscode.Disposable {
  return vscode.languages.registerCompletionItemProvider(
    JS_SELECTOR,
    {
      provideCompletionItems(document, position) {
        if (!isInheritedCompletionEnabled(document.uri)) {
          return undefined;
        }

        if (!isSupportedJsFile(document.fileName)) {
          return undefined;
        }

        if (!isThisMemberContext(document, position)) {
          return undefined;
        }

        try {
          const origins = resolveInheritedMemberCatalog(documentResolutionInput(document, position, {
            sourceCode: sourceForCompletionAnalysis(document, position),
            includeCurrentClass: false
          }));

          if (origins.length === 0) {
            return undefined;
          }

          const byMemberName = new Map<string, (typeof origins)[number]>();
          for (const origin of origins) {
            if (!byMemberName.has(origin.memberName)) {
              byMemberName.set(origin.memberName, origin);
            }
          }

          const items: vscode.CompletionItem[] = [];
          for (const origin of byMemberName.values()) {
            const item = new vscode.CompletionItem(
              origin.memberName,
              completionItemKind(origin.kind)
            );
            item.detail = `${origin.kind} from ${origin.ownerName}`;
            item.sortText = `1_${origin.memberName}`;

            const doc = new vscode.MarkdownString(undefined, true);
            doc.isTrusted = false;
            doc.supportHtml = false;
            doc.appendMarkdown(`**Defined in:** \`${origin.ownerName}\`\n\n`);
            doc.appendMarkdown(`- ${workspaceRelativePath(origin.filePath)}:${origin.line}\n`);
            if (origin.notes) {
              doc.appendMarkdown(`- ${origin.notes}\n`);
            }
            item.documentation = doc;

            items.push(item);
          }

          return items;
        } catch {
          return undefined;
        }
      }
    },
    "."
  );
}
