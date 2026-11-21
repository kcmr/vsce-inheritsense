import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";

const FILE_CANDIDATES = ["", ".js", ".mjs", ".cjs", "/index.js", "/index.mjs", "/index.cjs"];

function resolveWithFileCandidates(basePath: string): string | null {
  for (const suffix of FILE_CANDIDATES) {
    const candidate = basePath + suffix;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

function resolveRelativeImportPath(currentFilePath: string, importSource: string): string | null {
  const basePath = path.resolve(path.dirname(currentFilePath), importSource);
  return resolveWithFileCandidates(basePath);
}

function resolvePackageImportPath(currentFilePath: string, importSource: string): string | null {
  try {
    const requireFromCurrentFile = createRequire(currentFilePath);
    const resolved = requireFromCurrentFile.resolve(importSource);

    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      return resolved;
    }

    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      return resolveWithFileCandidates(path.join(resolved, "index"));
    }
  } catch {
    return null;
  }

  return null;
}

export function resolveImportPath(currentFilePath: string, importSource: string): string | null {
  if (importSource.startsWith(".")) {
    return resolveRelativeImportPath(currentFilePath, importSource);
  }

  return resolvePackageImportPath(currentFilePath, importSource);
}
