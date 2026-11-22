import * as vscode from "vscode";
import { workspaceRelativePath } from "../integration/workspacePaths";
import type { MemberOrigin } from "../model/types";

interface OriginItem extends vscode.QuickPickItem {
  origin: MemberOrigin;
}

export async function showOriginQuickPick(origins: MemberOrigin[]): Promise<MemberOrigin | null> {
  const items: OriginItem[] = origins.map((origin) => ({
    label: `${origin.memberName} (${origin.kind})`,
    description: `${origin.ownerName} [${origin.confidence}]`,
    detail: `${workspaceRelativePath(origin.filePath)}:${origin.line}${origin.notes ? ` - ${origin.notes}` : ""}`,
    origin
  }));

  const selected = await vscode.window.showQuickPick(items, {
    title: "InheritSense",
    placeHolder: "Select a member origin"
  });

  return selected?.origin ?? null;
}
