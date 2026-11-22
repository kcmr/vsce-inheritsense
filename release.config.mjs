import process from "node:process";

const publish = process.env.PUBLISH_RELEASE === "true";

export default {
  branches: ["main"],
  dryRun: !publish,
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    ["@semantic-release/changelog", { changelogFile: "CHANGELOG.md" }],
    ["semantic-release-vsce", { packageVsix: true, publish }],
    [
      "@semantic-release/git",
      {
        assets: ["CHANGELOG.md", "package.json", "pnpm-lock.yaml"],
        message: "chore(release): ${nextRelease.version} [skip ci]"
      }
    ],
    [
      "@semantic-release/github",
      {
        assets: [{ path: "*.vsix" }],
        successComment: false,
        failComment: false,
        releasedLabels: false
      }
    ]
  ]
};
