import type * as t from "@babel/types";

export type MemberKind = "method" | "getter" | "setter" | "field";
export type Confidence = "high" | "medium" | "low";

export interface MemberDeclaration {
  name: string;
  kind: MemberKind;
  line: number;
}

export interface ClassSymbol {
  name: string;
  members: MemberDeclaration[];
  injectorCalls: ProviderRef[];
  superClass: t.Expression | null;
  startLine: number;
  endLine: number;
}

export interface ImportBinding {
  source: string;
  // null denotes a module namespace, which requires member access.
  importedName: string | null;
}

export type ExportBinding = { localName: string } | ImportBinding;

export interface FileSymbols {
  classes: ClassSymbol[];
  imports: Map<string, ImportBinding>;
  exports: Map<string, ExportBinding>;
  exportedInitializers: Map<string, t.Expression>;
  injectors: Map<string, MemberDeclaration[]>;
}

export interface ProviderRef {
  localName: string;
  importLookupName?: string;
  notes?: string;
}

export interface MemberOrigin {
  memberName: string;
  kind: MemberKind;
  ownerName: string;
  filePath: string;
  line: number;
  confidence: Confidence;
  notes?: string;
}
