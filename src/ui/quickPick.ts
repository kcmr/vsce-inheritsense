import * as vscode from "vscode";
import * as path from "node:path";
import type { MemberOrigin } from "../model/types";

interface OriginItem extends vscode.QuickPickItem {
  origin: MemberOrigin;
}

function toRelativePath(filePath: string): string {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    return filePath;
  }
  return path.relative(root, filePath) || filePath;
}

export async function showOriginQuickPick(origins: MemberOrigin[]): Promise<MemberOrigin | null> {
  const items: OriginItem[] = origins.map((origin) => ({
    label: `${origin.memberName} (${origin.kind})`,
    description: `${origin.ownerName} [${origin.confidence}]`,
    detail: `${toRelativePath(origin.filePath)}:${origin.line}${origin.notes ? ` - ${origin.notes}` : ""}`,
    origin
  }));

  const selected = await vscode.window.showQuickPick(items, {
    title: "InheritSense",
    placeHolder: "Select a member origin"
  });

  return selected?.origin ?? null;
}
