import type { FileSymbols, ProviderRef } from "../model/types";
import { resolveImportPath } from "./importResolver";

interface ExportTarget {
  source?: string;
  provider: ProviderRef;
}

// Translate one module edge without carrying the caller's local alias into it.
export function resolveExportBinding(symbols: FileSymbols, provider: ProviderRef): ExportTarget | null {
  const binding = symbols.exports.get(provider.importLookupName ?? provider.localName);
  if (!binding) {
    return null;
  }
  if ("localName" in binding) {
    return {
      provider: provider.importLookupName !== undefined
        ? { localName: provider.localName, importLookupName: binding.localName, notes: provider.notes }
        : { localName: binding.localName, notes: provider.notes }
    };
  }
  if (binding.importedName === null) {
    return provider.importLookupName !== undefined
      ? { source: binding.source, provider: { localName: provider.localName, notes: provider.notes } }
      : null;
  }
  return {
    source: binding.source,
    provider: provider.importLookupName !== undefined
      ? { localName: provider.localName, importLookupName: binding.importedName, notes: provider.notes }
      : { localName: binding.importedName, notes: provider.notes }
  };
}

export function resolveImportedProvider(
  symbols: FileSymbols,
  ownerFilePath: string,
  provider: ProviderRef
): { filePath: string; provider: ProviderRef } | null {
  const binding = symbols.imports.get(provider.importLookupName ?? provider.localName);
  if (!binding || (binding.importedName === null && provider.importLookupName === undefined)) {
    return null;
  }
  const filePath = resolveImportPath(ownerFilePath, binding.source);
  if (!filePath) {
    return null;
  }
  const target = binding.importedName === null
    ? { localName: provider.localName, notes: provider.notes }
    : provider.importLookupName !== undefined
      ? { localName: provider.localName, importLookupName: binding.importedName, notes: provider.notes }
      : { localName: binding.importedName, notes: provider.notes };
  return { filePath, provider: target };
}

export function providerVisitKey(filePath: string, provider: ProviderRef, kind = "local"): string {
  return JSON.stringify([filePath, kind, provider.importLookupName ?? null, provider.localName]);
}
