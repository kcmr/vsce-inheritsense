import * as fs from "node:fs";
import type {
  ClassSymbol,
  FileSymbols,
  MemberDeclaration,
  MemberOrigin,
  ProviderRef
} from "../model/types";
import { extractFileSymbols } from "../parser/symbols";
import { resolveImportPath } from "./importResolver";
import { providerVisitKey, resolveExportBinding, resolveImportedProvider } from "./moduleBindings";
import { resolveProvidersFromExpression, resolveProvidersFromSuperClass } from "./inheritanceResolver";

interface ResolverBehaviorOptions {
  includeMethodAssignedFields?: boolean;
  includeMemberRanges?: boolean;
}

interface ResolveInput {
  filePath: string;
  sourceCode: string;
  memberName: string;
  line: number;
  includeCurrentClass?: boolean;
  includeMethodAssignedFields?: boolean;
  includeMemberRanges?: boolean;
}

interface ResolveCatalogInput {
  filePath: string;
  sourceCode: string;
  line: number;
  includeCurrentClass?: boolean;
  includeMethodAssignedFields?: boolean;
  includeMemberRanges?: boolean;
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
    ...(member.range ? { range: member.range } : {}),
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
    includeMethodAssignedFields: context.includeMethodAssignedFields,
    includeMemberRanges: context.includeMemberRanges
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
    yield* traverseProviders(symbols, filePath, resolveProvidersFromExpression(initializer), context);
  }
}

function dedupeOrigins(origins: MemberOrigin[]): MemberOrigin[] {
  const dedupKey = (origin: MemberOrigin): string =>
    `${origin.filePath}:${origin.line}:${origin.memberName}:${origin.ownerName}:${origin.kind}:${origin.range ? JSON.stringify(origin.range) : ""}`;

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
    includeMethodAssignedFields: input.includeMethodAssignedFields,
    includeMemberRanges: input.includeMemberRanges
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
      includeMemberRanges: input.includeMemberRanges
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
