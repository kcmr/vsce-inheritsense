import * as vscode from "vscode";
import { traceMemberOrigin } from "./commands/traceMemberOrigin";
import { registerMemberOriginCompletionProvider } from "./providers/memberOriginCompletionProvider";
import { registerMemberOriginDefinitionProvider } from "./providers/memberOriginDefinitionProvider";
import { registerMemberOriginHoverProvider } from "./providers/memberOriginHoverProvider";

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand(
    "inheritSense.traceSelectedSymbol",
    () => traceMemberOrigin()
  );

  context.subscriptions.push(disposable);
  context.subscriptions.push(registerMemberOriginHoverProvider());
  context.subscriptions.push(registerMemberOriginDefinitionProvider());
  context.subscriptions.push(registerMemberOriginCompletionProvider());
}

export function deactivate(): void {
  // No resources to dispose in MVP.
}
