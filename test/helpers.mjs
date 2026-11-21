import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
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

export function moduleGraph(context, files) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "inheritsense-test-")));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [relativePath, source] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, source);
  }
  return (relativePath) => path.join(root, relativePath);
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
