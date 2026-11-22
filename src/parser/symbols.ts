import * as t from "@babel/types";
import type {
    ClassSymbol,
    FileSymbols,
    ImportBinding,
    ExportBinding,
    MemberDeclaration,
    MemberKind,
    ProviderRef
} from "../model/types";
import { parseJavaScript } from "./ast";
import { dedupeProviders, expressionToProviderRef, findClassFromExpression, visitNode, visitThisScope } from "./astHelpers";
import { assignedMemberKind, dedupeMembers, memberNameFromKey, toMemberDeclarations } from "./members";
import type { ExtractSymbolsOptions } from "./members";

type AnyFunction = t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression;

export type { ExtractSymbolsOptions } from "./members";

function collectClassInjectorCalls(classNode: t.Class): ProviderRef[] {
  const found: ProviderRef[] = [];

  for (const element of classNode.body.body) {
    if (!t.isClassMethod(element) || !t.isBlockStatement(element.body)) {
      continue;
    }

    visitThisScope(element.body, (current) => {
      if (!t.isCallExpression(current)) {
        return;
      }

      const receivesThis = current.arguments.some((arg) => t.isThisExpression(arg));
      if (!receivesThis) {
        return;
      }

      const callee = current.callee;
      if (!t.isExpression(callee)) {
        return;
      }

      const provider = expressionToProviderRef(callee);
      if (provider) {
        found.push(provider);
      }
    });
  }

  return dedupeProviders(found);
}

function moduleName(node: t.Identifier | t.StringLiteral): string {
  return t.isIdentifier(node) ? node.name : node.value;
}

function bagAssignmentName(member: t.MemberExpression): string | null {
  if (member.computed && t.isStringLiteral(member.property)) {
    return member.property.value;
  }
  return t.isIdentifier(member.property) ? member.property.name : null;
}

function collectInjectedMembersFromStatement(
  statement: t.Statement,
  bagMembers: Map<string, MemberDeclaration[]>
): void {
  if (!t.isExpressionStatement(statement) || !t.isAssignmentExpression(statement.expression)) {
    return;
  }

  const assignment = statement.expression;
  if (assignment.operator !== "=" || !t.isMemberExpression(assignment.left)) {
    return;
  }

  if (!t.isIdentifier(assignment.left.object)) {
    return;
  }

  const bagName = assignment.left.object.name;
  const memberName = bagAssignmentName(assignment.left);

  if (!memberName) {
    return;
  }

  const bag = bagMembers.get(bagName) ?? [];
  const kind: MemberKind = assignedMemberKind(assignment.right);

  bag.push({
    name: memberName,
    kind,
    line: assignment.loc?.start.line ?? statement.loc?.start.line ?? 1
  });
  bagMembers.set(bagName, bag);
}

function collectBagMembers(programStatements: t.Statement[]): Map<string, MemberDeclaration[]> {
  const bagMembers = new Map<string, MemberDeclaration[]>();

  for (const statement of programStatements) {
    if (t.isVariableDeclaration(statement)) {
      for (const declaration of statement.declarations) {
        if (!t.isIdentifier(declaration.id)) {
          continue;
        }

        if (t.isObjectExpression(declaration.init)) {
          const members: MemberDeclaration[] = bagMembers.get(declaration.id.name) ?? [];
          for (const property of declaration.init.properties) {
            if (!t.isObjectProperty(property) || property.computed) {
              continue;
            }
            const memberName = memberNameFromKey(property.key);
            if (!memberName) {
              continue;
            }
            const kind: MemberKind = assignedMemberKind(property.value);
            members.push({
              name: memberName,
              kind,
              line: property.loc?.start.line ?? declaration.loc?.start.line ?? 1
            });
          }
          bagMembers.set(declaration.id.name, members);
        }
      }
      continue;
    }

    collectInjectedMembersFromStatement(statement, bagMembers);
  }

  return bagMembers;
}

interface FunctionInjectionMeta {
  directMembers: MemberDeclaration[];
  delegatedCalls: string[];
}

function collectLocalFunctions(programStatements: t.Statement[]): Map<string, AnyFunction> {
  const functions = new Map<string, AnyFunction>();

  for (const statement of programStatements) {
    const handleDeclaration = (declaration: t.Declaration): void => {
      if (t.isFunctionDeclaration(declaration) && declaration.id) {
        functions.set(declaration.id.name, declaration);
        return;
      }

      if (!t.isVariableDeclaration(declaration)) {
        return;
      }

      for (const variable of declaration.declarations) {
        if (!t.isIdentifier(variable.id) || !variable.init) {
          continue;
        }

        if (t.isArrowFunctionExpression(variable.init) || t.isFunctionExpression(variable.init)) {
          functions.set(variable.id.name, variable.init);
        }
      }
    };

    if (t.isFunctionDeclaration(statement) || t.isVariableDeclaration(statement)) {
      handleDeclaration(statement);
      continue;
    }

    if (t.isExportDefaultDeclaration(statement)) {
      const declaration = statement.declaration;
      if (t.isFunctionDeclaration(declaration) || t.isFunctionExpression(declaration) || t.isArrowFunctionExpression(declaration)) {
        const name = ("id" in declaration && declaration.id?.name) || "default";
        functions.set(name, declaration);
      }
      continue;
    }

    if (!t.isExportNamedDeclaration(statement) || !statement.declaration) {
      continue;
    }

    handleDeclaration(statement.declaration);
  }

  return functions;
}

function firstParamName(fn: AnyFunction): string | null {
  const firstParam = fn.params[0];
  return firstParam && t.isIdentifier(firstParam) ? firstParam.name : null;
}

function isNamedMember(node: t.Node, objectName: string, propertyName: string): boolean {
  return t.isMemberExpression(node) && !node.computed &&
    t.isIdentifier(node.object, { name: objectName }) &&
    t.isIdentifier(node.property, { name: propertyName });
}

function objectEntriesBagName(callee: t.Node): string | null {
  if (!t.isMemberExpression(callee) || callee.computed ||
      !t.isIdentifier(callee.property, { name: "forEach" }) ||
      !t.isCallExpression(callee.object)) {
    return null;
  }
  const entries = callee.object;
  if (!isNamedMember(entries.callee, "Object", "entries")) {
    return null;
  }
  const bag = entries.arguments[0];
  return t.isIdentifier(bag) ? bag.name : null;
}

function writesDynamicReceiver(fn: AnyFunction, receiverName: string): boolean {
  const param = fn.params[0];
  if (!t.isArrayPattern(param) || !t.isBlockStatement(fn.body)) {
    return false;
  }
  const key = param.elements[0];
  if (!t.isIdentifier(key)) {
    return false;
  }
  let found = false;
  visitNode(fn.body, (node) => {
    if (!t.isAssignmentExpression(node) || !t.isMemberExpression(node.left)) {
      return;
    }
    const left = node.left;
    if (left.computed && t.isIdentifier(left.object, { name: receiverName }) &&
        t.isIdentifier(left.property, { name: key.name })) {
      found = true;
    }
  });
  return found;
}

function receiverAssignmentName(node: t.Node, receiverName: string): string | null {
  if (!t.isAssignmentExpression(node, { operator: "=" }) || !t.isMemberExpression(node.left)) {
    return null;
  }
  const member = node.left;
  if (!t.isIdentifier(member.object, { name: receiverName })) {
    return null;
  }
  if (member.computed) {
    return t.isStringLiteral(member.property) ? member.property.value : null;
  }
  return t.isIdentifier(member.property) ? member.property.name : null;
}

function collectDynamicBagInjectionMembers(
  fn: AnyFunction,
  receiverParamName: string,
  bagMembers: Map<string, MemberDeclaration[]>
): MemberDeclaration[] {
  const found: MemberDeclaration[] = [];

  const body = t.isBlockStatement(fn.body) ? fn.body : null;
  if (!body) {
    return found;
  }

  visitNode(body, (current) => {
    if (!t.isCallExpression(current) || current.arguments.length === 0) {
      return;
    }

    const bagName = objectEntriesBagName(current.callee);
    if (!bagName) {
      return;
    }

    const callback = current.arguments[0];
    if (!t.isArrowFunctionExpression(callback) && !t.isFunctionExpression(callback)) {
      return;
    }
    if (!writesDynamicReceiver(callback, receiverParamName)) {
      return;
    }

    const bag = bagMembers.get(bagName) ?? [];
    found.push(...bag);
  });

  return found;
}

function collectFunctionInjectionMeta(
  functionName: string,
  fn: AnyFunction,
  bagMembers: Map<string, MemberDeclaration[]>
): FunctionInjectionMeta {
  const directMembers: MemberDeclaration[] = [];
  const delegatedCalls: string[] = [];

  const receiverParamName = firstParamName(fn);
  if (!receiverParamName || !t.isBlockStatement(fn.body)) {
    return { directMembers, delegatedCalls };
  }

  visitNode(fn.body, (current) => {
    const assignedName = receiverAssignmentName(current, receiverParamName);
    if (assignedName && t.isAssignmentExpression(current)) {
      directMembers.push({
        name: assignedName,
        kind: assignedMemberKind(current.right),
        line: current.loc?.start.line ?? fn.body.loc?.start.line ?? 1
      });
    }

    if (!t.isCallExpression(current) || !t.isIdentifier(current.callee)) {
      return;
    }

    if (current.callee.name === functionName || current.arguments.length === 0) {
      return;
    }

    const firstArg = current.arguments[0];
    if (t.isIdentifier(firstArg) && firstArg.name === receiverParamName) {
      delegatedCalls.push(current.callee.name);
    }
  });

  directMembers.push(...collectDynamicBagInjectionMembers(fn, receiverParamName, bagMembers));

  return {
    directMembers,
    delegatedCalls
  };
}

function collectInjectors(programStatements: t.Statement[]): Map<string, MemberDeclaration[]> {
  const bagMembers = collectBagMembers(programStatements);
  const localFunctions = collectLocalFunctions(programStatements);
  const metaByFunction = new Map<string, FunctionInjectionMeta>();

  for (const [name, fn] of localFunctions) {
    metaByFunction.set(name, collectFunctionInjectionMeta(name, fn, bagMembers));
  }

  const resolved = new Map<string, MemberDeclaration[]>();
  const resolving = new Set<string>();

  const resolveFunctionMembers = (functionName: string): MemberDeclaration[] => {
    const cached = resolved.get(functionName);
    if (cached) {
      return cached;
    }

    if (resolving.has(functionName)) {
      return [];
    }
    resolving.add(functionName);

    const meta = metaByFunction.get(functionName);
    if (!meta) {
      resolving.delete(functionName);
      resolved.set(functionName, []);
      return [];
    }

    const collected = [...meta.directMembers];
    for (const delegatedCall of meta.delegatedCalls) {
      collected.push(...resolveFunctionMembers(delegatedCall));
    }

    const deduped = dedupeMembers(collected);
    resolving.delete(functionName);
    resolved.set(functionName, deduped);
    return deduped;
  };

  for (const functionName of localFunctions.keys()) {
    resolveFunctionMembers(functionName);
  }

  const injectors = new Map<string, MemberDeclaration[]>();
  for (const [name, members] of resolved) {
    if (members.length > 0) {
      injectors.set(name, members);
    }
  }

  return injectors;
}

function toClassSymbol(name: string, classNode: t.Class, options?: ExtractSymbolsOptions): ClassSymbol {
  return {
    name,
    members: toMemberDeclarations(classNode, options),
    injectorCalls: collectClassInjectorCalls(classNode),
    superClass: classNode.superClass ?? null,
    startLine: classNode.loc?.start.line ?? 1,
    endLine: classNode.loc?.end.line ?? classNode.loc?.start.line ?? 1
  };
}

function collectImport(statement: t.ImportDeclaration, imports: Map<string, ImportBinding>): void {
  for (const specifier of statement.specifiers) {
    if (t.isImportSpecifier(specifier) || t.isImportDefaultSpecifier(specifier) || t.isImportNamespaceSpecifier(specifier)) {
      const importedName = t.isImportSpecifier(specifier)
        ? moduleName(specifier.imported)
        : t.isImportDefaultSpecifier(specifier) ? "default" : null;
      imports.set(specifier.local.name, { source: statement.source.value, importedName });
    }
  }
}

function collectNamedExportBindings(statement: t.ExportNamedDeclaration, exports: Map<string, ExportBinding>): void {
  for (const specifier of statement.specifiers) {
    const exportedName = moduleName(specifier.exported);
    if (t.isExportSpecifier(specifier)) {
      const localName = moduleName(specifier.local);
      exports.set(exportedName, statement.source
        ? { source: statement.source.value, importedName: localName }
        : { localName });
    } else if (t.isExportNamespaceSpecifier(specifier) && statement.source) {
      exports.set(exportedName, { source: statement.source.value, importedName: null });
    }
  }
}

function collectClass(name: string, node: t.Node, symbols: FileSymbols, options?: ExtractSymbolsOptions): void {
  const classNode = findClassFromExpression(node);
  if (classNode) {
    symbols.classes.push(toClassSymbol(name, classNode, options));
  }
}

function collectDeclaration(
  declaration: t.Declaration,
  symbols: FileSymbols,
  exported: boolean,
  options?: ExtractSymbolsOptions
): void {
  if ((t.isClassDeclaration(declaration) || t.isFunctionDeclaration(declaration)) && declaration.id) {
    const name = declaration.id.name;
    if (exported) {
      symbols.exports.set(name, { localName: name });
    }
    collectClass(name, declaration, symbols, options);
    return;
  }
  if (!t.isVariableDeclaration(declaration)) {
    return;
  }
  for (const variable of declaration.declarations) {
    if (!t.isIdentifier(variable.id) || !variable.init) {
      continue;
    }
    const name = variable.id.name;
    if (exported) {
      symbols.exports.set(name, { localName: name });
      symbols.exportedInitializers.set(name, variable.init);
    }
    collectClass(name, variable.init, symbols, options);
  }
}

function collectDefaultExport(
  declaration: t.ExportDefaultDeclaration["declaration"],
  symbols: FileSymbols,
  options?: ExtractSymbolsOptions
): void {
  if (t.isIdentifier(declaration)) {
    symbols.exports.set("default", { localName: declaration.name });
    return;
  }
  const name = ((t.isClassDeclaration(declaration) || t.isFunctionDeclaration(declaration) ||
    t.isClassExpression(declaration) || t.isFunctionExpression(declaration)) && declaration.id?.name) || "default";
  symbols.exports.set("default", { localName: name });
  collectClass(name, declaration, symbols, options);
  if (t.isExpression(declaration)) {
    symbols.exportedInitializers.set(name, declaration);
  }
}

export function extractFileSymbols(
  sourceCode: string,
  filePath: string,
  options?: ExtractSymbolsOptions
): FileSymbols {
  const ast = parseJavaScript(sourceCode, filePath);
  const symbols: FileSymbols = {
    classes: [],
    imports: new Map(),
    exports: new Map(),
    exportedInitializers: new Map(),
    injectors: collectInjectors(ast.program.body)
  };

  for (const statement of ast.program.body) {
    if (t.isImportDeclaration(statement)) {
      collectImport(statement, symbols.imports);
    } else if (t.isExportDefaultDeclaration(statement)) {
      collectDefaultExport(statement.declaration, symbols, options);
    } else if (t.isExportNamedDeclaration(statement)) {
      collectNamedExportBindings(statement, symbols.exports);
      if (statement.declaration) {
        collectDeclaration(statement.declaration, symbols, true, options);
      }
    } else if (t.isDeclaration(statement)) {
      collectDeclaration(statement, symbols, false, options);
    }
  }

  return symbols;
}
