import * as t from "@babel/types";
import type { MemberDeclaration, MemberKind } from "../model/types";
import { visitThisScope } from "./astHelpers";

export interface ExtractSymbolsOptions {
  includeMethodAssignedFields?: boolean;
  includeMemberRanges?: boolean;
}

export function memberDeclaration(
  name: string,
  kind: MemberKind,
  line: number,
  key: t.Node,
  options?: ExtractSymbolsOptions
): MemberDeclaration {
  const member: MemberDeclaration = { name, kind, line };
  if (options?.includeMemberRanges && key.loc) {
    member.range = {
      start: { line: key.loc.start.line - 1, character: key.loc.start.column },
      end: { line: key.loc.end.line - 1, character: key.loc.end.column }
    };
  }
  return member;
}

type AnyClassMember = t.ClassBody["body"][number];

function collectThisAssignedFieldsFromNode(node: t.Node, options?: ExtractSymbolsOptions): MemberDeclaration[] {
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
        found.push(memberDeclaration(
          current.left.property.name, "field", current.loc?.start.line ?? 1,
          current.left.property, options
        ));
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
    const rangeKey = includeLine && member.range ? JSON.stringify(member.range) : "";
    const key = `${member.name}:${member.kind}${includeLine ? `:${member.line}` : ""}:${rangeKey}`;
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

function collectExplicitMembers(classNode: t.Class, options?: ExtractSymbolsOptions): MemberDeclaration[] {
  const members: MemberDeclaration[] = [];
  for (const element of classNode.body.body) {
    const kind = getMemberKind(element);
    const name = getMemberName(element);
    if (kind && name && "key" in element) {
      members.push(memberDeclaration(
        name, kind, element.loc?.start.line ?? classNode.loc?.start.line ?? 1,
        element.key, options
      ));
    }
  }
  return members;
}

function collectPropertyBagMembers(object: t.ObjectExpression, fallbackLine: number, options?: ExtractSymbolsOptions): MemberDeclaration[] {
  const members: MemberDeclaration[] = [];
  for (const property of object.properties) {
    if (!t.isObjectProperty(property) || property.computed) {
      continue;
    }
    const name = memberNameFromKey(property.key);
    if (name) {
      members.push(memberDeclaration(name, "field", property.loc?.start.line ?? fallbackLine, property.key, options));
    }
  }
  return members;
}

function collectGetterProperties(getter: t.ClassMethod, fallbackLine: number, options?: ExtractSymbolsOptions): MemberDeclaration[] {
  const members: MemberDeclaration[] = [];
  for (const statement of getter.body.body) {
    if (t.isReturnStatement(statement) && statement.argument && t.isObjectExpression(statement.argument)) {
      members.push(...collectPropertyBagMembers(statement.argument, fallbackLine, options));
    }
  }
  return members;
}

function collectDeclarativeMembers(classNode: t.Class, options?: ExtractSymbolsOptions): MemberDeclaration[] {
  const members: MemberDeclaration[] = [];
  for (const element of classNode.body.body) {
    if (!t.isClassMethod(element) || !element.static || element.kind !== "get") {
      continue;
    }
    if (!t.isIdentifier(element.key) || element.key.name !== "properties") {
      continue;
    }
    members.push(...collectGetterProperties(element, element.loc?.start.line ?? classNode.loc?.start.line ?? 1, options));
  }
  return members;
}

function collectsAssignments(method: t.ClassMethod, includeMethodAssignedFields: boolean): boolean {
  return method.kind === "constructor" || (includeMethodAssignedFields && !method.static);
}

function collectAssignedMembers(classNode: t.Class, options?: ExtractSymbolsOptions): MemberDeclaration[] {
  const members: MemberDeclaration[] = [];
  for (const element of classNode.body.body) {
    if (!t.isClassMethod(element) || !collectsAssignments(element, options?.includeMethodAssignedFields ?? false)) {
      continue;
    }
    members.push(...collectThisAssignedFieldsFromNode(element.body, options));
  }
  return members;
}

export function toMemberDeclarations(classNode: t.Class, options?: ExtractSymbolsOptions): MemberDeclaration[] {
  const members = [
    ...collectExplicitMembers(classNode, options),
    ...collectDeclarativeMembers(classNode, options),
    ...collectAssignedMembers(classNode, options)
  ];
  // Classes keep the first declaration per name/kind; injectors retain distinct sites.
  return dedupeMembers(members, false);
}

// Function-valued receiver/bag assignments describe methods. Class this-assignments
// intentionally remain fields, including arrow/function values.
export function assignedMemberKind(value: t.Node): MemberKind {
  return t.isFunctionExpression(value) || t.isArrowFunctionExpression(value) ? "method" : "field";
}
