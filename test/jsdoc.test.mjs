import assert from "node:assert/strict";
import { test } from "node:test";
import { getOriginJsDoc, appendFormattedJsDoc } from "../dist/providers/jsDoc.js";

// Golden calls captured from the original hover implementation before extraction.
const cases = [
  {
    name: "single-line comment",
    source: `/** One line */
function run() {}`,
    doc: ["One line"],
    calls: [
      ["text", "One line"],
      ["markdown", "\n\n"]
    ]
  },
  {
    name: "summary and multiline tags",
    source: `/**
 * Summary <text>.
 *
 * More summary.
 * @param {string} name - Description
 * continued
 * @param plain
 * @returns {boolean} - Result
 * @return value
 * @deprecated Old
 * @example sample
 * @
 */

function run() {}`,
    doc: ["Summary <text>.", "", "More summary.", "@param {string} name - Description", "continued", "@param plain", "@returns {boolean} - Result", "@return value", "@deprecated Old", "@example sample", "@"],
    calls: [
      ["text", "Summary <text>.\n\nMore summary."],
      ["markdown", "\n\n"],
      ["markdown", "- **@param** `name` {`string`} - Description continued\n"],
      ["markdown", "- **@param** `plain`\n"],
      ["markdown", "- **@returns** {`boolean`} - - Result\n"],
      ["markdown", "- **@returns** - value\n"],
      ["markdown", "- **@deprecated** - Old\n"],
      ["markdown", "- **@example** - sample\n"],
      ["text", "@"],
      ["markdown", "\n"],
      ["markdown", "\n"]
    ]
  },
  {
    name: "ordinary comment",
    source: `/* ordinary */
function run() {}`,
    doc: null,
    calls: []
  },
  {
    name: "empty JSDoc",
    source: `/** */
function run() {}`,
    doc: null,
    calls: []
  },
  {
    name: "no preceding comment",
    source: `function run() {}`,
    doc: null,
    calls: []
  },
  {
    name: "unmatched closing delimiter",
    source: `*/
function run() {}`,
    doc: null,
    calls: []
  },
  {
    name: "ordinary block after JSDoc",
    source: `/** prior */
/* ordinary
*/
function run() {}`,
    doc: null,
    calls: []
  }
];
for (const { name, source, doc, calls } of cases) {
  test(`REF-03: preserves JSDoc extraction and Markdown calls for ${name}`, () => {
    const lines = source.split("\n");
    const actual = getOriginJsDoc("origin.js", lines.length, new Map([["origin.js", lines]]));
    assert.deepEqual(actual, doc);
    const actualCalls = [];
    if (actual) {
      appendFormattedJsDoc({
        appendText: (text) => actualCalls.push(["text", text]),
        appendMarkdown: (text) => actualCalls.push(["markdown", text])
      }, actual);
    }
    assert.deepEqual(actualCalls, calls);
  });
}

test("REF-03: JSDoc requires a cached source and a preceding line", () => {
  const lines = cases[0].source.split("\n");
  const cache = new Map([["origin.js", lines]]);
  assert.equal(getOriginJsDoc("missing.js", 2, cache), null);
  assert.equal(getOriginJsDoc("origin.js", 1, cache), null);
  assert.equal(getOriginJsDoc("origin.js", 0, cache), null);
});
