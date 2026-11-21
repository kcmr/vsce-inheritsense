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

type AnyClassMember = t.ClassBody["body"][number];
type AnyFunction = t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression;

export interface ExtractSymbolsOptions {
  includeMethodAssignedFields?: boolean;
}

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

function visitNode(node: t.Node, visitor: (current: t.Node) => boolean | void): void {
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
function visitThisScope(node: t.Node, visitor: (current: t.Node) => void): void {
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

function toProviderRefFromExpression(expression: t.Expression): ProviderRef | null {
  if (t.isIdentifier(expression)) {
    return { localName: expression.name };
  }

  if (t.isMemberExpression(expression) && !expression.computed && t.isIdentifier(expression.property) && t.isIdentifier(expression.object)) {
    return { localName: expression.property.name, importLookupName: expression.object.name };
  }

  return null;
}

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

      const provider = toProviderRefFromExpression(callee);
      if (provider) {
        found.push(provider);
      }
    });
  }

  const seen = new Set<string>();
  return found.filter((provider) => {
    const key = `${provider.localName}::${provider.importLookupName ?? ""}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function moduleName(node: t.Identifier | t.StringLiteral): string {
  return t.isIdentifier(node) ? node.name : node.value;
}

function memberNameFromKey(key: t.Expression | t.PrivateName): string | null {
  if (t.isIdentifier(key)) {
    return key.name;
  }

  if (t.isStringLiteral(key)) {
    return key.value;
  }

  return null;
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
  const memberName = assignment.left.computed
    ? t.isStringLiteral(assignment.left.property)
      ? assignment.left.property.value
      : t.isIdentifier(assignment.left.property)
        ? assignment.left.property.name
        : null
    : t.isIdentifier(assignment.left.property)
      ? assignment.left.property.name
      : null;

  if (!memberName) {
    return;
  }

  const bag = bagMembers.get(bagName) ?? [];
  const kind: MemberKind = t.isFunctionExpression(assignment.right) || t.isArrowFunctionExpression(assignment.right)
    ? "method"
    : "field";

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
            const kind: MemberKind = t.isFunctionExpression(property.value) || t.isArrowFunctionExpression(property.value)
              ? "method"
              : "field";
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

    const callee = current.callee;
    if (
      !t.isMemberExpression(callee) ||
      callee.computed ||
      !t.isIdentifier(callee.property) ||
      callee.property.name !== "forEach" ||
      !t.isCallExpression(callee.object)
    ) {
      return;
    }

    const objectEntriesCall = callee.object;
    if (
      !t.isMemberExpression(objectEntriesCall.callee) ||
      objectEntriesCall.callee.computed ||
      !t.isIdentifier(objectEntriesCall.callee.object) ||
      objectEntriesCall.callee.object.name !== "Object" ||
      !t.isIdentifier(objectEntriesCall.callee.property) ||
      objectEntriesCall.callee.property.name !== "entries"
    ) {
      return;
    }

    const bagArg = objectEntriesCall.arguments[0];
    if (!bagArg || !t.isIdentifier(bagArg)) {
      return;
    }

    const callback = current.arguments[0];
    if (!(t.isArrowFunctionExpression(callback) || t.isFunctionExpression(callback))) {
      return;
    }

    const callbackFirstParam = callback.params[0];
    if (!callbackFirstParam || !t.isArrayPattern(callbackFirstParam)) {
      return;
    }

    const keyItem = callbackFirstParam.elements[0];
    if (!keyItem || !t.isIdentifier(keyItem)) {
      return;
    }

    const callbackBody = t.isBlockStatement(callback.body) ? callback.body : null;
    if (!callbackBody) {
      return;
    }

    let writesReceiverByDynamicKey = false;
    visitNode(callbackBody, (callbackNode) => {
      if (!t.isAssignmentExpression(callbackNode) || !t.isMemberExpression(callbackNode.left)) {
        return;
      }
      const left = callbackNode.left;
      if (!left.computed || !t.isIdentifier(left.object) || !t.isIdentifier(left.property)) {
        return;
      }
      if (left.object.name === receiverParamName && left.property.name === keyItem.name) {
        writesReceiverByDynamicKey = true;
      }
    });

    if (!writesReceiverByDynamicKey) {
      return;
    }

    const bag = bagMembers.get(bagArg.name) ?? [];
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
    if (t.isAssignmentExpression(current) && t.isMemberExpression(current.left) && current.operator === "=") {
      const member = current.left;
      if (t.isIdentifier(member.object) && member.object.name === receiverParamName) {
        const assignedName = member.computed
          ? t.isStringLiteral(member.property)
            ? member.property.value
            : null
          : t.isIdentifier(member.property)
            ? member.property.name
            : null;

        if (assignedName) {
          const kind: MemberKind = t.isFunctionExpression(current.right) || t.isArrowFunctionExpression(current.right)
            ? "method"
            : "field";
          directMembers.push({
            name: assignedName,
            kind,
            line: current.loc?.start.line ?? fn.body.loc?.start.line ?? 1
          });
        }
      }
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

function dedupeMembers(members: MemberDeclaration[]): MemberDeclaration[] {
  const seen = new Set<string>();
  return members.filter((member) => {
    const key = `${member.name}:${member.kind}:${member.line}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
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

function getMemberName(node: AnyClassMember): string | null {
  if (
    "key" in node &&
    "computed" in node &&
    t.isIdentifier(node.key) &&
    !node.computed
  ) {
    return node.key.name;
  }
  if (
    "key" in node &&
    "computed" in node &&
    t.isStringLiteral(node.key) &&
    !node.computed
  ) {
    return node.key.value;
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

function toMemberDeclarations(classNode: t.Class, options?: ExtractSymbolsOptions): MemberDeclaration[] {
  const includeMethodAssignedFields = options?.includeMethodAssignedFields ?? false;
  const members: MemberDeclaration[] = [];

  for (const element of classNode.body.body) {
    const kind = getMemberKind(element);
    if (!kind) {
      continue;
    }

    const name = getMemberName(element);
    if (!name) {
      continue;
    }

    members.push({
      name,
      kind,
      line: element.loc?.start.line ?? classNode.loc?.start.line ?? 1
    });
  }

  for (const element of classNode.body.body) {
    if (!t.isClassMethod(element)) {
      continue;
    }

    if (!element.static || element.kind !== "get") {
      continue;
    }

    if (!t.isIdentifier(element.key) || element.key.name !== "properties") {
      continue;
    }

    if (!t.isBlockStatement(element.body)) {
      continue;
    }

    for (const statement of element.body.body) {
      if (!t.isReturnStatement(statement) || !statement.argument || !t.isObjectExpression(statement.argument)) {
        continue;
      }

      for (const property of statement.argument.properties) {
        if (!t.isObjectProperty(property) || property.computed) {
          continue;
        }

        let propertyName: string | null = null;
        if (t.isIdentifier(property.key)) {
          propertyName = property.key.name;
        } else if (t.isStringLiteral(property.key)) {
          propertyName = property.key.value;
        }

        if (!propertyName) {
          continue;
        }

        members.push({
          name: propertyName,
          kind: "field",
          line: property.loc?.start.line ?? element.loc?.start.line ?? classNode.loc?.start.line ?? 1
        });
      }
    }
  }

  for (const element of classNode.body.body) {
    if (!t.isClassMethod(element)) {
      continue;
    }

    if (element.kind !== "constructor" && !includeMethodAssignedFields) {
      continue;
    }

    if (element.kind !== "constructor" && element.static) {
      continue;
    }

    if (!t.isBlockStatement(element.body)) {
      continue;
    }

    const assignedMembers = collectThisAssignedFieldsFromNode(element.body);
    for (const assignedMember of assignedMembers) {
      members.push({
        ...assignedMember,
        line: assignedMember.line ?? element.loc?.start.line ?? classNode.loc?.start.line ?? 1
      });
    }
  }

  const unique = new Map<string, MemberDeclaration>();
  for (const member of members) {
    const key = `${member.name}:${member.kind}`;
    if (!unique.has(key)) {
      unique.set(key, member);
    }
  }

  return [...unique.values()];
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
          const nestedClass = findClassFromExpression(statement.argument);
          if (nestedClass) {
            return nestedClass;
          }
        }
      }
    }

    return null;
  }

  if (t.isCallExpression(expression)) {
    for (const arg of expression.arguments) {
      if (!t.isExpression(arg)) {
        continue;
      }

      const nestedClass = findClassFromExpression(arg);
      if (nestedClass) {
        return nestedClass;
      }
    }

    return findClassFromExpression(expression.callee);
  }

  return null;
}

export function extractFileSymbols(
  sourceCode: string,
  filePath: string,
  options?: ExtractSymbolsOptions
): FileSymbols {
  const ast = parseJavaScript(sourceCode, filePath);
  const imports = new Map<string, ImportBinding>();
  const exports = new Map<string, ExportBinding>();
  const exportedInitializers = new Map<string, t.Expression>();
  const classes: ClassSymbol[] = [];
  const injectors = collectInjectors(ast.program.body);

  for (const statement of ast.program.body) {
    if (t.isImportDeclaration(statement)) {
      for (const specifier of statement.specifiers) {
        if (t.isImportSpecifier(specifier) || t.isImportDefaultSpecifier(specifier) || t.isImportNamespaceSpecifier(specifier)) {
          const importedName = t.isImportSpecifier(specifier)
            ? moduleName(specifier.imported)
            : t.isImportDefaultSpecifier(specifier) ? "default" : null;
          imports.set(specifier.local.name, { source: statement.source.value, importedName });
        }
      }
      continue;
    }

    if (t.isClassDeclaration(statement) && statement.id) {
      classes.push(toClassSymbol(statement.id.name, statement, options));
      continue;
    }

    if (t.isFunctionDeclaration(statement) && statement.id) {
      const classNode = findClassFromExpression(statement);
      if (classNode) {
        classes.push(toClassSymbol(statement.id.name, classNode, options));
      }
      continue;
    }

    if (t.isExportDefaultDeclaration(statement)) {
      const declaration = statement.declaration;
      if (t.isIdentifier(declaration)) {
        exports.set("default", { localName: declaration.name });
        continue;
      }
      const name = ((t.isClassDeclaration(declaration) || t.isFunctionDeclaration(declaration) ||
        t.isClassExpression(declaration) || t.isFunctionExpression(declaration)) && declaration.id?.name) || "default";
      exports.set("default", { localName: name });
      const classNode = findClassFromExpression(declaration);
      if (classNode) {
        classes.push(toClassSymbol(name, classNode, options));
      }
      if (t.isExpression(declaration)) {
        exportedInitializers.set(name, declaration);
      }
      continue;
    }

    if (t.isExportNamedDeclaration(statement)) {
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

      const declaration = statement.declaration;
      if (declaration && (t.isClassDeclaration(declaration) || t.isFunctionDeclaration(declaration)) && declaration.id) {
        exports.set(declaration.id.name, { localName: declaration.id.name });
      }
      if (!declaration) {
        continue;
      }

      if (t.isClassDeclaration(declaration) && declaration.id) {
        classes.push(toClassSymbol(declaration.id.name, declaration, options));
        continue;
      }

      if (t.isFunctionDeclaration(declaration) && declaration.id) {
        const classNode = findClassFromExpression(declaration);
        if (classNode) {
          classes.push(toClassSymbol(declaration.id.name, classNode, options));
        }
        continue;
      }

      if (t.isVariableDeclaration(declaration)) {
        for (const variable of declaration.declarations) {
          if (!t.isIdentifier(variable.id) || !variable.init) {
            continue;
          }

          exports.set(variable.id.name, { localName: variable.id.name });
          exportedInitializers.set(variable.id.name, variable.init);

          const classNode = t.isClassExpression(variable.init)
            ? variable.init
            : findClassFromExpression(variable.init);

          if (classNode) {
            classes.push(toClassSymbol(variable.id.name, classNode, options));
          }
        }
      }

      continue;
    }

    if (t.isVariableDeclaration(statement)) {
      for (const variable of statement.declarations) {
        if (!t.isIdentifier(variable.id) || !variable.init) {
          continue;
        }

        const classNode = t.isClassExpression(variable.init)
          ? variable.init
          : findClassFromExpression(variable.init);

        if (classNode) {
          classes.push(toClassSymbol(variable.id.name, classNode, options));
        }
      }
    }
  }

  return {
    classes,
    imports,
    exports,
    exportedInitializers,
    injectors
  };
}
