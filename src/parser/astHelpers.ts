import * as t from "@babel/types";
import type { ProviderRef } from "../model/types";

export function visitNode(node: t.Node, visitor: (current: t.Node) => boolean | void): void {
  if (visitor(node) === false) {
    return;
  }
  const keys = t.VISITOR_KEYS[node.type] ?? [];
  for (const key of keys) {
    const value = (node as unknown as Record<string, unknown>)[key];

    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof child === "object" && "type" in child) {
          visitNode(child as t.Node, visitor);
        }
      }
      continue;
    }

    if (value && typeof value === "object" && "type" in value) {
      visitNode(value as t.Node, visitor);
    }
  }
}

// Follow lexical this through arrows, but stop at functions and class bodies.
// Heritage and computed keys are evaluated in the enclosing this context.
export function visitThisScope(node: t.Node, visitor: (current: t.Node) => void): void {
  visitNode(node, (current) => {
    if (t.isClass(current)) {
      if (current.superClass) {
        visitThisScope(current.superClass, visitor);
      }
      for (const element of current.body.body) {
        if ("computed" in element && element.computed && "key" in element) {
          visitThisScope(element.key, visitor);
        }
      }
      return false;
    }

    if (t.isFunction(current) && !t.isArrowFunctionExpression(current)) {
      if (t.isObjectMethod(current) && current.computed) {
        visitThisScope(current.key, visitor);
      }
      return false;
    }

    visitor(current);
  });
}

export function expressionToProviderRef(expression: t.Node): ProviderRef | null {
  if (t.isIdentifier(expression)) {
    return { localName: expression.name };
  }

  if (t.isMemberExpression(expression) && !expression.computed && t.isIdentifier(expression.property) && t.isIdentifier(expression.object)) {
    return { localName: expression.property.name, importLookupName: expression.object.name };
  }

  return null;
}

function findReturnedClass(body: t.BlockStatement | t.Expression): t.Class | null {
  if (t.isClassExpression(body)) {
    return body;
  }
  if (!t.isBlockStatement(body)) {
    return null;
  }
  for (const statement of body.body) {
    if (t.isReturnStatement(statement) && statement.argument) {
      const classNode = findClassFromExpression(statement.argument);
      if (classNode) {
        return classNode;
      }
    }
  }
  return null;
}

function findClassInCall(call: t.CallExpression): t.Class | null {
  for (const arg of call.arguments) {
    if (!t.isExpression(arg)) {
      continue;
    }
    const classNode = findClassFromExpression(arg);
    if (classNode) {
      return classNode;
    }
  }
  return findClassFromExpression(call.callee);
}

export function findClassFromExpression(expression: t.Node | null | undefined): t.Class | null {
  if (!expression) {
    return null;
  }
  if (t.isClassExpression(expression) || t.isClassDeclaration(expression)) {
    return expression;
  }
  if (t.isArrowFunctionExpression(expression) || t.isFunctionExpression(expression) || t.isFunctionDeclaration(expression)) {
    return findReturnedClass(expression.body);
  }
  if (t.isCallExpression(expression)) {
    return findClassInCall(expression);
  }
  return null;
}

export function dedupeProviders(providers: ProviderRef[]): ProviderRef[] {
  const seen = new Set<string>();
  return providers.filter((provider) => {
    const key = `${provider.localName}::${provider.importLookupName ?? ""}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
