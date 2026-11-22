import * as fs from "node:fs";
import * as t from "@babel/types";
import type {
  ClassSymbol,
  FileSymbols,
  MemberDeclaration,
  MemberOrigin,
  MemberKind,
  ProviderRef
} from "../model/types";
import { extractFileSymbols } from "../parser/symbols";
import { resolveImportPath } from "./importResolver";
import { providerVisitKey, resolveExportBinding, resolveImportedProvider } from "./moduleBindings";
import { resolveProvidersFromExpression, resolveProvidersFromSuperClass } from "./inheritanceResolver";

interface ResolverBehaviorOptions {
  includeMethodAssignedFields?: boolean;
}

interface ResolveInput {
  filePath: string;
  sourceCode: string;
  memberName: string;
  line: number;
  includeCurrentClass?: boolean;
  includeMethodAssignedFields?: boolean;
}

interface ResolveCatalogInput {
  filePath: string;
  sourceCode: string;
  line: number;
  includeCurrentClass?: boolean;
  includeMethodAssignedFields?: boolean;
}

function toOrigin(
  member: MemberDeclaration,
  ownerName: string,
  filePath: string,
  confidence: "high" | "medium" | "low",
  notes?: string
): MemberOrigin {
  return {
    memberName: member.name,
    kind: member.kind,
    ownerName,
    filePath,
    line: member.line,
    confidence,
    notes
  };
}

function findClassAtLine(classes: ClassSymbol[], line: number): ClassSymbol | null {
  const containing = classes.filter((candidate) => line >= candidate.startLine && line <= candidate.endLine);
  if (containing.length === 0) {
    return null;
  }

  containing.sort((a, b) => (a.endLine - a.startLine) - (b.endLine - b.startLine));
  return containing[0] ?? null;
}

type TraversalKind = "provider" | "injector";

interface TraversalContext extends ResolverBehaviorOptions {
  visited: Set<string>;
  // Lookup keeps the existing initializer extraction fallback until REF-02.
  memberName?: string;
}

function* memberOrigins(
  members: MemberDeclaration[],
  ownerName: string,
  filePath: string,
  confidence: MemberOrigin["confidence"],
  notes?: string
): Generator<MemberOrigin> {
  for (const member of members) {
    yield toOrigin(member, ownerName, filePath, confidence, notes);
  }
}

function* traverseExportedMembers(
  filePath: string,
  provider: ProviderRef,
  kind: TraversalKind,
  context: TraversalContext
): Generator<MemberOrigin> {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const visitKey = providerVisitKey(filePath, provider, kind === "injector" ? "injector-export" : "export");
  if (context.visited.has(visitKey)) {
    return;
  }
  context.visited.add(visitKey);

  const symbols = extractFileSymbols(fs.readFileSync(filePath, "utf8"), filePath, {
    includeMethodAssignedFields: context.includeMethodAssignedFields
  });
  const target = resolveExportBinding(symbols, provider);
  if (!target) {
    return;
  }
  if (target.source !== undefined) {
    const resolved = resolveImportPath(filePath, target.source);
    if (resolved) {
      yield* traverseExportedMembers(resolved, target.provider, kind, context);
    }
    return;
  }
  yield* traverseMembersInSymbols(symbols, filePath, target.provider, kind, context);
}

function* traverseImportedMembers(
  symbols: FileSymbols,
  filePath: string,
  provider: ProviderRef,
  kind: TraversalKind,
  context: TraversalContext
): Generator<MemberOrigin> {
  const target = resolveImportedProvider(symbols, filePath, provider);
  if (target) {
    yield* traverseExportedMembers(target.filePath, target.provider, kind, context);
  }
}

function* traverseMembersInSymbols(
  symbols: FileSymbols,
  filePath: string,
  provider: ProviderRef,
  kind: TraversalKind,
  context: TraversalContext
): Generator<MemberOrigin> {
  const visitKey = providerVisitKey(filePath, provider, kind === "injector" ? "injector" : "local");
  if (context.visited.has(visitKey)) {
    return;
  }
  context.visited.add(visitKey);

  if (kind === "injector") {
    const members = (provider.importLookupName === undefined ? symbols.injectors.get(provider.localName) : undefined) ?? [];
    yield* memberOrigins(members, provider.localName, filePath, "medium", "runtime injector call");
  } else {
    yield* traverseProviderMembers(symbols, filePath, provider, context);
  }
  yield* traverseImportedMembers(symbols, filePath, provider, kind, context);
}

function* traverseProviders(
  symbols: FileSymbols,
  filePath: string,
  providers: ProviderRef[],
  context: TraversalContext
): Generator<MemberOrigin> {
  for (const provider of providers) {
    yield* traverseMembersInSymbols(symbols, filePath, provider, "provider", context);
  }
}

function* traverseProviderMembers(
  symbols: FileSymbols,
  filePath: string,
  provider: ProviderRef,
  context: TraversalContext
): Generator<MemberOrigin> {
  if (provider.importLookupName !== undefined) {
    return;
  }
  const providerClass = symbols.classes.find((candidate) => candidate.name === provider.localName);
  if (providerClass) {
    yield* memberOrigins(providerClass.members, providerClass.name, filePath, "high", provider.notes);
    for (const injector of providerClass.injectorCalls) {
      yield* traverseMembersInSymbols(symbols, filePath, injector, "injector", context);
    }
    yield* traverseProviders(symbols, filePath, resolveProvidersFromSuperClass(providerClass.superClass), context);
  }

  const initializer = symbols.exportedInitializers.get(provider.localName);
  if (initializer) {
    // Catalog extraction intentionally remains parser-based; REF-02 owns parity.
    if (context.memberName !== undefined) {
      const origin = findMemberFromExportedInitializer(initializer, provider.localName, context.memberName, filePath);
      if (origin) {
        yield origin;
      }
    }
    yield* traverseProviders(symbols, filePath, resolveProvidersFromExpression(initializer), context);
  }
}

function findClassFromExpression(expression: t.Node | null | undefined): t.Class | null {
  if (!expression) {
    return null;
  }

  if (t.isClassExpression(expression) || t.isClassDeclaration(expression)) {
    return expression;
  }

  if (t.isArrowFunctionExpression(expression) || t.isFunctionExpression(expression) || t.isFunctionDeclaration(expression)) {
    if (t.isClassExpression(expression.body)) {
      return expression.body;
    }
    if (t.isBlockStatement(expression.body)) {
      for (const statement of expression.body.body) {
        if (t.isReturnStatement(statement) && statement.argument) {
          const nested = findClassFromExpression(statement.argument);
          if (nested) {
            return nested;
          }
        }
      }
    }
    return null;
  }

  if (t.isCallExpression(expression)) {
    for (const arg of expression.arguments) {
      if (t.isExpression(arg)) {
        const nested = findClassFromExpression(arg);
        if (nested) {
          return nested;
        }
      }
    }

    const nestedCallee = findClassFromExpression(expression.callee);
    if (nestedCallee) {
      return nestedCallee;
    }
  }

  return null;
}

function findMemberFromExportedInitializer(
  initializer: t.Expression,
  exportedName: string,
  memberName: string,
  filePath: string
): MemberOrigin | null {
  const classNode = findClassFromExpression(initializer);
  if (!classNode) {
    return null;
  }

  const line = classNode.loc?.start.line ?? 1;
  for (const element of classNode.body.body) {
    if (!(t.isClassMethod(element) || t.isClassProperty(element))) {
      continue;
    }

    if (!t.isIdentifier(element.key) || element.computed) {
      continue;
    }

    if (element.key.name !== memberName) {
      continue;
    }

    const kind: MemberKind = t.isClassMethod(element)
      ? element.kind === "get"
        ? "getter"
        : element.kind === "set"
          ? "setter"
          : "method"
      : "field";

    return {
      memberName,
      kind,
      ownerName: exportedName,
      filePath,
      line: element.loc?.start.line ?? line,
      confidence: "high"
    };
  }

  return null;
}

function dedupeOrigins(origins: MemberOrigin[]): MemberOrigin[] {
  const dedupKey = (origin: MemberOrigin): string =>
    `${origin.filePath}:${origin.line}:${origin.memberName}:${origin.ownerName}:${origin.kind}`;

  const seen = new Set<string>();
  return origins.filter((origin) => {
    const key = dedupKey(origin);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

// Consuming only the first match closes the generator before later branches read
// or parse files. Catalogs exhaust the same traversal and retain shadowed origins.
function selectOrigins(origins: Iterable<MemberOrigin>, memberName?: string): MemberOrigin[] {
  if (memberName === undefined) {
    return Array.from(origins);
  }
  for (const origin of origins) {
    if (origin.memberName === memberName) {
      return [origin];
    }
  }
  return [];
}

function resolveOrigins(input: ResolveCatalogInput, memberName?: string): MemberOrigin[] {
  const includeCurrentClass = input.includeCurrentClass ?? (memberName !== undefined);
  const symbols = extractFileSymbols(input.sourceCode, input.filePath, {
    includeMethodAssignedFields: input.includeMethodAssignedFields
  });
  const currentClass = findClassAtLine(symbols.classes, input.line);
  if (!currentClass) {
    return [];
  }

  const origins: MemberOrigin[] = [];
  if (includeCurrentClass) {
    origins.push(...selectOrigins(
      memberOrigins(currentClass.members, currentClass.name, input.filePath, "high", "member in current class"),
      memberName
    ));
  }

  for (const provider of resolveProvidersFromSuperClass(currentClass.superClass)) {
    // Each root provider has its own search, preserving multiple composition origins.
    const context: TraversalContext = {
      visited: new Set([providerVisitKey(input.filePath, { localName: currentClass.name })]),
      includeMethodAssignedFields: input.includeMethodAssignedFields,
      memberName
    };
    origins.push(...selectOrigins(
      traverseMembersInSymbols(symbols, input.filePath, provider, "provider", context), memberName
    ));
  }
  return dedupeOrigins(origins);
}

export function resolveInheritedMemberCatalog(input: ResolveCatalogInput): MemberOrigin[] {
  return resolveOrigins(input);
}

export function resolveMemberOrigins(input: ResolveInput): MemberOrigin[] {
  return resolveOrigins(input, input.memberName);
}
