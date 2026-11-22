import assert from "node:assert/strict";
import { Position, Range, Uri } from "./vscode.mjs";

export function positionOf(source, marker, offset = 0) {
  const index = source.indexOf(marker);
  assert.notEqual(index, -1, `Missing marker: ${marker}`);
  const prefix = source.slice(0, index + offset).split("\n");
  return new Position(prefix.length - 1, prefix.at(-1).length);
}

export function textDocument(fileName, source) {
  const lines = source.split("\n");
  const offsetAt = (position) => lines.slice(0, position.line).reduce((n, line) => n + line.length + 1, 0) + position.character;
  return {
    fileName, uri: Uri.file(fileName), version: 1, offsetAt,
    getText(range) { return range ? source.slice(offsetAt(range.start), offsetAt(range.end)) : source; },
    lineAt(position) { return { text: lines[position.line] }; },
    getWordRangeAtPosition(position) {
      const words = lines[position.line].matchAll(/[\w$]+/g);
      for (const word of words) {
        if (position.character >= word.index && position.character <= word.index + word[0].length) {
          return new Range(new Position(position.line, word.index), new Position(position.line, word.index + word[0].length));
        }
      }
      return undefined;
    }
  };
}
