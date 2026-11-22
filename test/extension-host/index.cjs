/* global module */
// VS Code loads the test entry through CommonJS, including on older hosts.
module.exports.run = async () => {
  const { fileURLToPath, pathToFileURL, URL } = await import("node:url");
  const { runWithReport } = await import("./report.mjs");
  const reportPath = fileURLToPath(new URL("../../.test-results/ref04-extension-host.json", pathToFileURL(module.filename)));
  await runWithReport(async (report) => {
    const suite = await import("./suite.mjs");
    await suite.run(report);
  }, reportPath);
};
