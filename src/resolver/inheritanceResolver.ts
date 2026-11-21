import * as t from "@babel/types";
import type { ProviderRef } from "../model/types";

function expressionToProviderRef(expression: t.Expression): ProviderRef | null {
  if (t.isIdentifier(expression)) {
    return { localName: expression.name };
  }

  if (t.isMemberExpression(expression) && !expression.computed && t.isIdentifier(expression.property)) {
    const provider: ProviderRef = {
      localName: expression.property.name
    };

    if (t.isIdentifier(expression.object)) {
      provider.importLookupName = expression.object.name;
    }

    return provider;
  }

  return null;
}

function collectFromCallExpression(call: t.CallExpression, providers: ProviderRef[]): void {
  const calleeProvider = expressionToProviderRef(call.callee as t.Expression);
  if (calleeProvider) {
    providers.push({
      ...calleeProvider,
      notes: "factory/mixin call"
    });
  }

  for (const arg of call.arguments) {
    if (t.isExpression(arg)) {
      const provider = expressionToProviderRef(arg);
      if (provider) {
        providers.push({
          ...provider,
          notes: "factory argument"
        });
      }

      if (t.isCallExpression(arg)) {
        collectFromCallExpression(arg, providers);
      }
    }
  }
}

export function resolveProvidersFromSuperClass(superClass: t.Expression | null): ProviderRef[] {
  if (!superClass) {
    return [];
  }

  return resolveProvidersFromExpression(superClass);
}

export function resolveProvidersFromExpression(expression: t.Expression | null): ProviderRef[] {
  if (!expression) {
    return [];
  }

  const providers: ProviderRef[] = [];

  if (t.isIdentifier(expression)) {
    providers.push({ localName: expression.name, notes: "direct extends" });
  } else if (t.isCallExpression(expression)) {
    collectFromCallExpression(expression, providers);
  } else {
    const provider = expressionToProviderRef(expression);
    if (provider) {
      providers.push({ ...provider, notes: "extends expression" });
    }
  }

  const seen = new Set<string>();
  return providers.filter((provider) => {
    const dedupeKey = `${provider.localName}::${provider.importLookupName ?? ""}`;
    if (seen.has(dedupeKey)) {
      return false;
    }
    seen.add(dedupeKey);
    return true;
  });
}
