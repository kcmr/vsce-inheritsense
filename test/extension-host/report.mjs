import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export async function runWithReport(suite, reportPath) {
  const result = { status: "running", messages: [] };
  mkdirSync(path.dirname(reportPath), { recursive: true });
  const save = () => writeFileSync(reportPath, JSON.stringify(result, null, 2) + "\n");
  save();
  try {
    await suite((message) => {
      result.messages.push(message);
      save();
    });
    result.status = "passed";
  } catch (error) {
    result.status = "failed";
    result.error = error instanceof Error ? error.stack ?? error.message : String(error);
    throw error;
  } finally {
    save();
  }
}
