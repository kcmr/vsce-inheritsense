import * as vscode from "vscode";
import type { MemberOrigin } from "../model/types";

export function definitionLocation(origin: MemberOrigin): vscode.Location {
  const target = origin.range
    ? new vscode.Range(
      new vscode.Position(origin.range.start.line, origin.range.start.character),
      new vscode.Position(origin.range.end.line, origin.range.end.character)
    )
    : new vscode.Position(Math.max(0, origin.line - 1), 0);
  return new vscode.Location(vscode.Uri.file(origin.filePath), target);
}

function sameRange(left: vscode.Range, right: vscode.Range): boolean {
  return left.start.line === right.start.line && left.start.character === right.start.character &&
    left.end.line === right.end.line && left.end.character === right.end.character;
}

function hasEquivalentSelection(location: vscode.Location, candidate: vscode.Location | vscode.DefinitionLink): boolean {
  // Our reentrant callback returns Locations; the public command can normalize
  // those into links without a selection range. Only suppress a distinct
  // provider's explicit selection of the exact same declaration.
  return "targetUri" in candidate && candidate.targetSelectionRange !== undefined &&
    candidate.targetUri.fsPath === location.uri.fsPath && sameRange(candidate.targetSelectionRange, location.range);
}

export async function omitNativeDefinitions(
  document: vscode.TextDocument,
  position: vscode.Position,
  locations: vscode.Location[],
  pending: Set<string>
): Promise<vscode.Location[] | undefined> {
  const key = `${document.uri.toString()}:${document.version}:${position.line}:${position.character}`;
  if (pending.has(key)) {
    // Contribute our precise locations to the nested query without querying
    // again. This also preserves fallback results for overlapping requests.
    return locations;
  }
  pending.add(key);
  try {
    const definitions = await vscode.commands.executeCommand<Array<vscode.Location | vscode.DefinitionLink>>(
      "vscode.executeDefinitionProvider", document.uri, position
    );
    const remaining = locations.filter((location) =>
      !definitions?.some((candidate) => hasEquivalentSelection(location, candidate)));
    return remaining.length > 0 ? remaining : undefined;
  } catch {
    return locations;
  } finally {
    pending.delete(key);
  }
}
