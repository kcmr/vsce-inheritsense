import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";

export function fixturePath(relativePath) {
  return fileURLToPath(new URL(`./fixtures/${relativePath}`, import.meta.url));
}

export function sourceLine(source, marker) {
  const index = source.split("\n").findIndex((line) => line.includes(marker));
  assert.notEqual(index, -1, `Missing source marker: ${marker}`);
  return index + 1;
}

export function documentInput(filePath, marker) {
  const sourceCode = readFileSync(filePath, "utf8");
  return { filePath, sourceCode, line: sourceLine(sourceCode, marker) };
}

export function fixtureSource(relativePath) {
  return readFileSync(fixturePath(relativePath), "utf8");
}

export function fixtureGraph(context, relativePath) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "inheritsense-test-")));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(fixturePath(relativePath), root, { recursive: true });
  // Keep package fixtures tracked without checking a node_modules tree into Git.
  const dependencies = path.join(root, "package-dependencies");
  if (existsSync(dependencies)) {
    renameSync(dependencies, path.join(root, "node_modules"));
  }
  return (relativeFile) => path.join(root, relativeFile);
}

export function assertOrigin(origin, { memberName, kind, ownerName, filePath, marker, confidence }) {
  assert.ok(origin, `Missing origin for ${memberName}`);
  assert.equal(origin.memberName, memberName);
  assert.equal(origin.kind, kind);
  assert.equal(origin.ownerName, ownerName);
  assert.equal(origin.filePath, filePath);
  assert.equal(origin.line, sourceLine(readFileSync(filePath, "utf8"), marker));
  if (confidence) {
    assert.equal(origin.confidence, confidence);
  }
}
