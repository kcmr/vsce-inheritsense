import * as t from "@babel/types";
import type { MemberDeclaration, MemberKind } from "../model/types";
import { visitThisScope } from "./astHelpers";

export interface ExtractSymbolsOptions {
  includeMethodAssignedFields?: boolean;
}

type AnyClassMember = t.ClassBody["body"][number];

function collectThisAssignedFieldsFromNode(node: t.Node): MemberDeclaration[] {
  const found: MemberDeclaration[] = [];

  visitThisScope(node, (current) => {
    if (t.isAssignmentExpression(current)) {
      if (
        current.operator === "=" &&
        t.isMemberExpression(current.left) &&
        !current.left.computed &&
        t.isThisExpression(current.left.object) &&
        t.isIdentifier(current.left.property)
      ) {
        found.push({
          name: current.left.property.name,
          kind: "field",
          line: current.loc?.start.line ?? 1
        });
      }
    }
  });
  return found;
}

export function memberNameFromKey(key: t.Expression | t.PrivateName): string | null {
  if (t.isIdentifier(key)) {
    return key.name;
  }

  if (t.isStringLiteral(key)) {
    return key.value;
  }

  return null;
}

export function dedupeMembers(members: MemberDeclaration[], includeLine = true): MemberDeclaration[] {
  const seen = new Set<string>();
  return members.filter((member) => {
    const key = `${member.name}:${member.kind}${includeLine ? `:${member.line}` : ""}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getMemberName(node: AnyClassMember): string | null {
  if ("key" in node && "computed" in node && !node.computed) {
    return memberNameFromKey(node.key);
  }
  return null;
}

function getMemberKind(node: AnyClassMember): MemberKind | null {
  if (t.isClassMethod(node)) {
    if (node.kind === "method") {
      return "method";
    }
    if (node.kind === "get") {
      return "getter";
    }
    if (node.kind === "set") {
      return "setter";
    }
    return null;
  }

  if (t.isClassProperty(node) || t.isClassPrivateProperty(node)) {
    return "field";
  }

  return null;
}

function collectExplicitMembers(classNode: t.Class): MemberDeclaration[] {
  const members: MemberDeclaration[] = [];
  for (const element of classNode.body.body) {
    const kind = getMemberKind(element);
    const name = getMemberName(element);
    if (kind && name) {
      members.push({
        name,
        kind,
        line: element.loc?.start.line ?? classNode.loc?.start.line ?? 1
      });
    }
  }
  return members;
}

function collectPropertyBagMembers(object: t.ObjectExpression, fallbackLine: number): MemberDeclaration[] {
  const members: MemberDeclaration[] = [];
  for (const property of object.properties) {
    if (!t.isObjectProperty(property) || property.computed) {
      continue;
    }
    const name = memberNameFromKey(property.key);
    if (name) {
      members.push({ name, kind: "field", line: property.loc?.start.line ?? fallbackLine });
    }
  }
  return members;
}

function collectGetterProperties(getter: t.ClassMethod, fallbackLine: number): MemberDeclaration[] {
  const members: MemberDeclaration[] = [];
  for (const statement of getter.body.body) {
    if (t.isReturnStatement(statement) && statement.argument && t.isObjectExpression(statement.argument)) {
      members.push(...collectPropertyBagMembers(statement.argument, fallbackLine));
    }
  }
  return members;
}

function collectDeclarativeMembers(classNode: t.Class): MemberDeclaration[] {
  const members: MemberDeclaration[] = [];
  for (const element of classNode.body.body) {
    if (!t.isClassMethod(element) || !element.static || element.kind !== "get") {
      continue;
    }
    if (!t.isIdentifier(element.key) || element.key.name !== "properties") {
      continue;
    }
    members.push(...collectGetterProperties(element, element.loc?.start.line ?? classNode.loc?.start.line ?? 1));
  }
  return members;
}

function collectsAssignments(method: t.ClassMethod, includeMethodAssignedFields: boolean): boolean {
  return method.kind === "constructor" || (includeMethodAssignedFields && !method.static);
}

function collectAssignedMembers(classNode: t.Class, includeMethodAssignedFields: boolean): MemberDeclaration[] {
  const members: MemberDeclaration[] = [];
  for (const element of classNode.body.body) {
    if (!t.isClassMethod(element) || !collectsAssignments(element, includeMethodAssignedFields)) {
      continue;
    }
    members.push(...collectThisAssignedFieldsFromNode(element.body));
  }
  return members;
}

export function toMemberDeclarations(classNode: t.Class, options?: ExtractSymbolsOptions): MemberDeclaration[] {
  const members = [
    ...collectExplicitMembers(classNode),
    ...collectDeclarativeMembers(classNode),
    ...collectAssignedMembers(classNode, options?.includeMethodAssignedFields ?? false)
  ];
  // Classes keep the first declaration per name/kind; injectors retain source lines.
  return dedupeMembers(members, false);
}

// Function-valued receiver/bag assignments describe methods. Class this-assignments
// intentionally remain fields, including arrow/function values.
export function assignedMemberKind(value: t.Node): MemberKind {
  return t.isFunctionExpression(value) || t.isArrowFunctionExpression(value) ? "method" : "field";
}
