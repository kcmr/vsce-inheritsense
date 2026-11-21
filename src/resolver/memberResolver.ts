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

  const visitKey = `${filePath}::injector::${injector.localName}`;
  if (visited.has(visitKey)) {
    return null;
  }
  visited.add(visitKey);

  const sourceCode = fs.readFileSync(filePath, "utf8");
  const symbols = extractFileSymbols(sourceCode, filePath, {
    includeMethodAssignedFields: options?.includeMethodAssignedFields
  });

  const injectorMembers = symbols.injectors.get(injector.localName) ?? [];
  const injectedMember = injectorMembers.find((member) => member.name === memberName);
  if (injectedMember) {
    return toOrigin(injectedMember, injector.localName, filePath, "medium", "runtime injector call");
  }

  const source = symbols.imports.get(injector.importLookupName ?? injector.localName);
  if (!source) {
    return null;
  }

  const resolved = resolveImportPath(filePath, source);
  if (!resolved) {
    return null;
  }

  return findInjectedMemberInFile(resolved, injector, memberName, visited, options);
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

  const visitKey = `${filePath}::injector::${injector.localName}`;
  if (visited.has(visitKey)) {
    return [];
  }
  visited.add(visitKey);

  const sourceCode = fs.readFileSync(filePath, "utf8");
  const symbols = extractFileSymbols(sourceCode, filePath, {
    includeMethodAssignedFields: options?.includeMethodAssignedFields
  });

  const collected = (symbols.injectors.get(injector.localName) ?? [])
    .map((member) => toOrigin(member, injector.localName, filePath, "medium", "runtime injector call"));

  const source = symbols.imports.get(injector.importLookupName ?? injector.localName);
  if (!source) {
    return collected;
  }

  const resolved = resolveImportPath(filePath, source);
  if (!resolved) {
    return collected;
  }

  const nested = collectInjectedMembersInFile(resolved, injector, visited, options);
  collected.push(...nested);
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
    const localMembers = symbols.injectors.get(injector.localName) ?? [];
    const localMatch = localMembers.find((member) => member.name === memberName);
    if (localMatch) {
      return toOrigin(localMatch, injector.localName, ownerFilePath, "medium", "runtime injector call");
    }

    const source = symbols.imports.get(injector.importLookupName ?? injector.localName);
    if (!source) {
      continue;
    }

    const resolved = resolveImportPath(ownerFilePath, source);
    if (!resolved) {
      continue;
    }

    const imported = findInjectedMemberInFile(
      resolved,
      injector,
      memberName,
      visited,
      options
    );
    if (imported) {
      return imported;
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
    const localMembers = symbols.injectors.get(injector.localName) ?? [];
    for (const member of localMembers) {
      collected.push(toOrigin(member, injector.localName, ownerFilePath, "medium", "runtime injector call"));
    }

    const source = symbols.imports.get(injector.importLookupName ?? injector.localName);
    if (!source) {
      continue;
    }

    const resolved = resolveImportPath(ownerFilePath, source);
    if (!resolved) {
      continue;
    }

    const imported = collectInjectedMembersInFile(
      resolved,
      injector,
      visited,
      options
    );
    collected.push(...imported);
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
    const localNestedClass = symbols.classes.find((candidate) => candidate.name === nestedProvider.localName);
    if (localNestedClass) {
      const nestedFound = findProviderMemberInSymbols(
        symbols, ownerFilePath, nestedProvider, memberName, visited, options
      );
      if (nestedFound) {
        return nestedFound;
      }
      continue;
    }

    const nestedSource = symbols.imports.get(nestedProvider.importLookupName ?? nestedProvider.localName);
    if (!nestedSource) {
      continue;
    }

    const nestedResolved = resolveImportPath(ownerFilePath, nestedSource);
    if (!nestedResolved) {
      continue;
    }

    const nestedFound = findProviderMemberInFile(
      nestedResolved,
      nestedProvider,
      memberName,
      visited,
      options
    );
    if (nestedFound) {
      return nestedFound;
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
    const localNestedClass = symbols.classes.find((candidate) => candidate.name === nestedProvider.localName);
    if (localNestedClass) {
      collected.push(...collectProviderMembersInSymbols(
        symbols, ownerFilePath, nestedProvider, visited, options
      ));
      continue;
    }

    const nestedSource = symbols.imports.get(nestedProvider.importLookupName ?? nestedProvider.localName);
    if (!nestedSource) {
      continue;
    }

    const nestedResolved = resolveImportPath(ownerFilePath, nestedSource);
    if (!nestedResolved) {
      continue;
    }

    const nestedCollected = collectProviderMembersInFile(
      nestedResolved,
      nestedProvider,
      visited,
      options
    );
    collected.push(...nestedCollected);
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

  const visitKey = `${filePath}::${provider.localName}`;
  if (visited.has(visitKey)) {
    return null;
  }

  const sourceCode = fs.readFileSync(filePath, "utf8");
  const symbols = extractFileSymbols(sourceCode, filePath, {
    includeMethodAssignedFields: options?.includeMethodAssignedFields
  });

  return findProviderMemberInSymbols(symbols, filePath, provider, memberName, visited, options);
}

function findProviderMemberInSymbols(
  symbols: ReturnType<typeof extractFileSymbols>,
  filePath: string,
  provider: ProviderRef,
  memberName: string,
  visited: Set<string>,
  options?: ResolverBehaviorOptions
): MemberOrigin | null {
  const visitKey = `${filePath}::${provider.localName}`;
  if (visited.has(visitKey)) {
    return null;
  }
  visited.add(visitKey);

  const providerClass = symbols.classes.find((candidate) => candidate.name === provider.localName);
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

  const exportedInitializer = symbols.exportedInitializers.get(provider.localName);
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

  const aliasSource = symbols.imports.get(provider.importLookupName ?? provider.localName);
  if (!aliasSource) {
    return null;
  }

  const aliasResolved = resolveImportPath(filePath, aliasSource);
  if (!aliasResolved) {
    return null;
  }

  return findProviderMemberInFile(aliasResolved, provider, memberName, visited, options);
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

  const visitKey = `${filePath}::${provider.localName}`;
  if (visited.has(visitKey)) {
    return [];
  }

  const sourceCode = fs.readFileSync(filePath, "utf8");
  const symbols = extractFileSymbols(sourceCode, filePath, {
    includeMethodAssignedFields: options?.includeMethodAssignedFields
  });
  return collectProviderMembersInSymbols(symbols, filePath, provider, visited, options);
}

function collectProviderMembersInSymbols(
  symbols: ReturnType<typeof extractFileSymbols>,
  filePath: string,
  provider: ProviderRef,
  visited: Set<string>,
  options?: ResolverBehaviorOptions
): MemberOrigin[] {
  const visitKey = `${filePath}::${provider.localName}`;
  if (visited.has(visitKey)) {
    return [];
  }
  visited.add(visitKey);

  const collected: MemberOrigin[] = [];

  const providerClass = symbols.classes.find((candidate) => candidate.name === provider.localName);
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

  const exportedInitializer = symbols.exportedInitializers.get(provider.localName);
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

  const aliasSource = symbols.imports.get(provider.importLookupName ?? provider.localName);
  if (!aliasSource) {
    return collected;
  }

  const aliasResolved = resolveImportPath(filePath, aliasSource);
  if (!aliasResolved) {
    return collected;
  }

  const aliasedCollected = collectProviderMembersInFile(aliasResolved, provider, visited, options);
  collected.push(...aliasedCollected);

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
    const localClass = symbols.classes.find((candidate) => candidate.name === provider.localName);
    if (localClass) {
      origins.push(...collectProviderMembersInSymbols(
        symbols, input.filePath, provider,
        new Set([`${input.filePath}::${currentClass.name}`]),
        { includeMethodAssignedFields: input.includeMethodAssignedFields }
      ));
      continue;
    }

    const source = symbols.imports.get(provider.importLookupName ?? provider.localName);
    if (!source) {
      continue;
    }

    const resolved = resolveImportPath(input.filePath, source);
    if (!resolved) {
      continue;
    }

    const importedMembers = collectProviderMembersInFile(resolved, provider, new Set([`${input.filePath}::${currentClass.name}`]), {
      includeMethodAssignedFields: input.includeMethodAssignedFields
    });
    origins.push(...importedMembers);
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
    const localClass = symbols.classes.find((candidate) => candidate.name === provider.localName);
    if (localClass) {
      const origin = findProviderMemberInSymbols(
        symbols, input.filePath, provider, input.memberName,
        new Set([`${input.filePath}::${currentClass.name}`]),
        { includeMethodAssignedFields: input.includeMethodAssignedFields }
      );
      if (origin) {
        origins.push(origin);
      }
      continue;
    }

    const source = symbols.imports.get(provider.importLookupName ?? provider.localName);
    if (!source) {
      continue;
    }

    const resolved = resolveImportPath(input.filePath, source);
    if (!resolved) {
      continue;
    }

    const importedOrigin = findProviderMemberInFile(
      resolved,
      provider,
      input.memberName,
      new Set([`${input.filePath}::${currentClass.name}`]),
      {
        includeMethodAssignedFields: input.includeMethodAssignedFields
      }
    );
    if (importedOrigin) {
      origins.push(importedOrigin);
    }
  }

  return dedupeOrigins(origins);
}
