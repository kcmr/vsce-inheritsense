import * as fs from "node:fs";
import * as t from "@babel/types";
import type {
  ClassSymbol,
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

function findMember(classSymbol: ClassSymbol, memberName: string): MemberDeclaration | null {
  return classSymbol.members.find((member) => member.name === memberName) ?? null;
}

function findInjectedMemberInFile(
  filePath: string,
  injector: ProviderRef,
  memberName: string,
  visited: Set<string>,
  options?: ResolverBehaviorOptions
): MemberOrigin | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const exportKey = providerVisitKey(filePath, injector, "injector-export");
  if (visited.has(exportKey)) {
    return null;
  }
  visited.add(exportKey);

  const sourceCode = fs.readFileSync(filePath, "utf8");
  const symbols = extractFileSymbols(sourceCode, filePath, {
    includeMethodAssignedFields: options?.includeMethodAssignedFields
  });

  const target = resolveExportBinding(symbols, injector);
  if (!target) {
    return null;
  }
  if (target.source !== undefined) {
    const resolved = resolveImportPath(filePath, target.source);
    return resolved ? findInjectedMemberInFile(resolved, target.provider, memberName, visited, options) : null;
  }
  return findInjectedMemberInSymbols(symbols, filePath, target.provider, memberName, visited, options);
}

function findInjectedMemberInSymbols(
  symbols: ReturnType<typeof extractFileSymbols>,
  filePath: string,
  injector: ProviderRef,
  memberName: string,
  visited: Set<string>,
  options?: ResolverBehaviorOptions
): MemberOrigin | null {
  const visitKey = providerVisitKey(filePath, injector, "injector");
  if (visited.has(visitKey)) {
    return null;
  }
  visited.add(visitKey);

  const injectorMembers = (injector.importLookupName === undefined ? symbols.injectors.get(injector.localName) : undefined) ?? [];
  const injectedMember = injectorMembers.find((member) => member.name === memberName);
  if (injectedMember) {
    return toOrigin(injectedMember, injector.localName, filePath, "medium", "runtime injector call");
  }

  const target = resolveImportedProvider(symbols, filePath, injector);
  return target ? findInjectedMemberInFile(target.filePath, target.provider, memberName, visited, options) : null;
}

function collectInjectedMembersInFile(
  filePath: string,
  injector: ProviderRef,
  visited: Set<string>,
  options?: ResolverBehaviorOptions
): MemberOrigin[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const exportKey = providerVisitKey(filePath, injector, "injector-export");
  if (visited.has(exportKey)) {
    return [];
  }
  visited.add(exportKey);

  const sourceCode = fs.readFileSync(filePath, "utf8");
  const symbols = extractFileSymbols(sourceCode, filePath, {
    includeMethodAssignedFields: options?.includeMethodAssignedFields
  });

  const target = resolveExportBinding(symbols, injector);
  if (!target) {
    return [];
  }
  if (target.source !== undefined) {
    const resolved = resolveImportPath(filePath, target.source);
    return resolved ? collectInjectedMembersInFile(resolved, target.provider, visited, options) : [];
  }
  return collectInjectedMembersInSymbols(symbols, filePath, target.provider, visited, options);
}

function collectInjectedMembersInSymbols(
  symbols: ReturnType<typeof extractFileSymbols>,
  filePath: string,
  injector: ProviderRef,
  visited: Set<string>,
  options?: ResolverBehaviorOptions
): MemberOrigin[] {
  const visitKey = providerVisitKey(filePath, injector, "injector");
  if (visited.has(visitKey)) {
    return [];
  }
  visited.add(visitKey);

  const collected = ((injector.importLookupName === undefined ? symbols.injectors.get(injector.localName) : undefined) ?? [])
    .map((member) => toOrigin(member, injector.localName, filePath, "medium", "runtime injector call"));

  const target = resolveImportedProvider(symbols, filePath, injector);
  if (target) {
    collected.push(...collectInjectedMembersInFile(target.filePath, target.provider, visited, options));
  }
  return collected;
}

function findInjectedMemberFromClassInjectors(
  symbols: ReturnType<typeof extractFileSymbols>,
  ownerFilePath: string,
  classSymbol: ClassSymbol,
  memberName: string,
  visited: Set<string>,
  options?: ResolverBehaviorOptions
): MemberOrigin | null {
  for (const injector of classSymbol.injectorCalls) {
    const origin = findInjectedMemberInSymbols(symbols, ownerFilePath, injector, memberName, visited, options);
    if (origin) {
      return origin;
    }
  }

  return null;
}

function collectInjectedMembersFromClassInjectors(
  symbols: ReturnType<typeof extractFileSymbols>,
  ownerFilePath: string,
  classSymbol: ClassSymbol,
  visited: Set<string>,
  options?: ResolverBehaviorOptions
): MemberOrigin[] {
  const collected: MemberOrigin[] = [];

  for (const injector of classSymbol.injectorCalls) {
    collected.push(...collectInjectedMembersInSymbols(symbols, ownerFilePath, injector, visited, options));
  }

  return collected;
}

function findMemberFromProviders(
  symbols: ReturnType<typeof extractFileSymbols>,
  ownerFilePath: string,
  providers: ProviderRef[],
  memberName: string,
  visited: Set<string>,
  options?: ResolverBehaviorOptions
): MemberOrigin | null {
  for (const nestedProvider of providers) {
    const origin = findProviderMemberInSymbols(symbols, ownerFilePath, nestedProvider, memberName, visited, options);
    if (origin) {
      return origin;
    }
  }

  return null;
}

function collectMembersFromProviders(
  symbols: ReturnType<typeof extractFileSymbols>,
  ownerFilePath: string,
  providers: ProviderRef[],
  visited: Set<string>,
  options?: ResolverBehaviorOptions
): MemberOrigin[] {
  const collected: MemberOrigin[] = [];

  for (const nestedProvider of providers) {
    collected.push(...collectProviderMembersInSymbols(symbols, ownerFilePath, nestedProvider, visited, options));
  }

  return collected;
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

function findProviderMemberInFile(
  filePath: string,
  provider: ProviderRef,
  memberName: string,
  visited: Set<string>,
  options?: ResolverBehaviorOptions
): MemberOrigin | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const visitKey = providerVisitKey(filePath, provider, "export");
  if (visited.has(visitKey)) {
    return null;
  }

  visited.add(visitKey);

  const sourceCode = fs.readFileSync(filePath, "utf8");
  const symbols = extractFileSymbols(sourceCode, filePath, {
    includeMethodAssignedFields: options?.includeMethodAssignedFields
  });

  const target = resolveExportBinding(symbols, provider);
  if (!target) {
    return null;
  }
  if (target.source !== undefined) {
    const resolved = resolveImportPath(filePath, target.source);
    return resolved ? findProviderMemberInFile(resolved, target.provider, memberName, visited, options) : null;
  }
  return findProviderMemberInSymbols(symbols, filePath, target.provider, memberName, visited, options);
}

function findProviderMemberInSymbols(
  symbols: ReturnType<typeof extractFileSymbols>,
  filePath: string,
  provider: ProviderRef,
  memberName: string,
  visited: Set<string>,
  options?: ResolverBehaviorOptions
): MemberOrigin | null {
  const visitKey = providerVisitKey(filePath, provider);
  if (visited.has(visitKey)) {
    return null;
  }
  visited.add(visitKey);

  const providerClass = provider.importLookupName === undefined
    ? symbols.classes.find((candidate) => candidate.name === provider.localName) : undefined;
  if (providerClass) {
    const member = findMember(providerClass, memberName);
    if (member) {
      return toOrigin(member, providerClass.name, filePath, "high", provider.notes);
    }

    const injectedMember = findInjectedMemberFromClassInjectors(
      symbols,
      filePath,
      providerClass,
      memberName,
      visited,
      options
    );
    if (injectedMember) {
      return injectedMember;
    }

    const nestedFound = findMemberFromProviders(
      symbols,
      filePath,
      resolveProvidersFromSuperClass(providerClass.superClass),
      memberName,
      visited,
      options
    );
    if (nestedFound) {
      return nestedFound;
    }
  }

  const exportedInitializer = provider.importLookupName === undefined
    ? symbols.exportedInitializers.get(provider.localName) : undefined;
  if (exportedInitializer) {
    const exportedResult = findMemberFromExportedInitializer(
      exportedInitializer,
      provider.localName,
      memberName,
      filePath
    );
    if (exportedResult) {
      return exportedResult;
    }

    const nestedFound = findMemberFromProviders(
      symbols,
      filePath,
      resolveProvidersFromExpression(exportedInitializer),
      memberName,
      visited,
      options
    );
    if (nestedFound) {
      return nestedFound;
    }
  }

  const target = resolveImportedProvider(symbols, filePath, provider);
  return target ? findProviderMemberInFile(target.filePath, target.provider, memberName, visited, options) : null;
}

function collectProviderMembersInFile(
  filePath: string,
  provider: ProviderRef,
  visited: Set<string>,
  options?: ResolverBehaviorOptions
): MemberOrigin[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const visitKey = providerVisitKey(filePath, provider, "export");
  if (visited.has(visitKey)) {
    return [];
  }

  visited.add(visitKey);

  const sourceCode = fs.readFileSync(filePath, "utf8");
  const symbols = extractFileSymbols(sourceCode, filePath, {
    includeMethodAssignedFields: options?.includeMethodAssignedFields
  });
  const target = resolveExportBinding(symbols, provider);
  if (!target) {
    return [];
  }
  if (target.source !== undefined) {
    const resolved = resolveImportPath(filePath, target.source);
    return resolved ? collectProviderMembersInFile(resolved, target.provider, visited, options) : [];
  }
  return collectProviderMembersInSymbols(symbols, filePath, target.provider, visited, options);
}

function collectProviderMembersInSymbols(
  symbols: ReturnType<typeof extractFileSymbols>,
  filePath: string,
  provider: ProviderRef,
  visited: Set<string>,
  options?: ResolverBehaviorOptions
): MemberOrigin[] {
  const visitKey = providerVisitKey(filePath, provider);
  if (visited.has(visitKey)) {
    return [];
  }
  visited.add(visitKey);

  const collected: MemberOrigin[] = [];

  const providerClass = provider.importLookupName === undefined
    ? symbols.classes.find((candidate) => candidate.name === provider.localName) : undefined;
  if (providerClass) {
    for (const member of providerClass.members) {
      collected.push(toOrigin(member, providerClass.name, filePath, "high", provider.notes));
    }

    const injectedCollected = collectInjectedMembersFromClassInjectors(
      symbols,
      filePath,
      providerClass,
      visited,
      options
    );
    collected.push(...injectedCollected);

    const nestedCollected = collectMembersFromProviders(
      symbols,
      filePath,
      resolveProvidersFromSuperClass(providerClass.superClass),
      visited,
      options
    );
    collected.push(...nestedCollected);
  }

  const exportedInitializer = provider.importLookupName === undefined
    ? symbols.exportedInitializers.get(provider.localName) : undefined;
  if (exportedInitializer) {
    const nestedCollected = collectMembersFromProviders(
      symbols,
      filePath,
      resolveProvidersFromExpression(exportedInitializer),
      visited,
      options
    );
    collected.push(...nestedCollected);
  }

  const target = resolveImportedProvider(symbols, filePath, provider);
  if (target) {
    collected.push(...collectProviderMembersInFile(target.filePath, target.provider, visited, options));
  }
  return collected;
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

export function resolveInheritedMemberCatalog(input: ResolveCatalogInput): MemberOrigin[] {
  const includeCurrentClass = input.includeCurrentClass ?? false;
  const symbols = extractFileSymbols(input.sourceCode, input.filePath, {
    includeMethodAssignedFields: input.includeMethodAssignedFields
  });
  const currentClass = findClassAtLine(symbols.classes, input.line);

  if (!currentClass) {
    return [];
  }

  const origins: MemberOrigin[] = [];
  if (includeCurrentClass) {
    for (const member of currentClass.members) {
      origins.push(toOrigin(member, currentClass.name, input.filePath, "high", "member in current class"));
    }
  }

  const providers = resolveProvidersFromSuperClass(currentClass.superClass);
  for (const provider of providers) {
    origins.push(...collectProviderMembersInSymbols(
      symbols, input.filePath, provider, new Set([providerVisitKey(input.filePath, { localName: currentClass.name })]),
      { includeMethodAssignedFields: input.includeMethodAssignedFields }
    ));
  }

  return dedupeOrigins(origins);
}

export function resolveMemberOrigins(input: ResolveInput): MemberOrigin[] {
  const includeCurrentClass = input.includeCurrentClass ?? true;
  const symbols = extractFileSymbols(input.sourceCode, input.filePath, {
    includeMethodAssignedFields: input.includeMethodAssignedFields
  });
  const currentClass = findClassAtLine(symbols.classes, input.line);

  if (!currentClass) {
    return [];
  }

  const origins: MemberOrigin[] = [];
  const localMember = findMember(currentClass, input.memberName);
  if (localMember && includeCurrentClass) {
    origins.push(toOrigin(localMember, currentClass.name, input.filePath, "high", "member in current class"));
  }

  const providers = resolveProvidersFromSuperClass(currentClass.superClass);
  for (const provider of providers) {
    const origin = findProviderMemberInSymbols(
      symbols, input.filePath, provider, input.memberName, new Set([providerVisitKey(input.filePath, { localName: currentClass.name })]),
      { includeMethodAssignedFields: input.includeMethodAssignedFields }
    );
    if (origin) {
      origins.push(origin);
    }
  }

  return dedupeOrigins(origins);
}
