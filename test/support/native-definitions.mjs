import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

export function nativeDefinitionService(context, files, compiler = ts) {
  const host = {
    getCompilationSettings: () => ({ allowJs: true, target: compiler.ScriptTarget.ES2022, module: compiler.ModuleKind.ESNext }),
    getScriptFileNames: () => files,
    getScriptVersion: () => "1",
    getScriptSnapshot(file) {
      const source = compiler.sys.readFile(file);
      return source === undefined ? undefined : compiler.ScriptSnapshot.fromString(source);
    },
    getCurrentDirectory: () => path.dirname(files[0]),
    getDefaultLibFileName: (options) => compiler.getDefaultLibFilePath(options),
    fileExists: compiler.sys.fileExists,
    readFile: compiler.sys.readFile,
    readDirectory: compiler.sys.readDirectory
  };
  const service = compiler.createLanguageService(host);
  context.after(() => service.dispose());
  return service;
}

export function nativeDefinitionTargets(service, filePath, offset) {
  return (service.getDefinitionAtPosition(filePath, offset) ?? []).map((definition) => {
    const file = service.getProgram().getSourceFile(definition.fileName);
    const start = file.getLineAndCharacterOfPosition(definition.textSpan.start);
    const end = file.getLineAndCharacterOfPosition(definition.textSpan.start + definition.textSpan.length);
    const context = definition.contextSpan ?? definition.textSpan;
    const contextRange = {
      start: file.getLineAndCharacterOfPosition(context.start),
      end: file.getLineAndCharacterOfPosition(context.start + context.length)
    };
    return { filePath: definition.fileName, range: { start, end }, contextRange };
  });
}

export function rangeText(filePath, range) {
  const source = readFileSync(filePath, "utf8");
  const offset = (position) => source.split("\n").slice(0, position.line)
    .reduce((total, line) => total + line.length + 1, 0) + position.character;
  return source.slice(offset(range.start), offset(range.end));
}
