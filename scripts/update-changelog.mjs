import { readFile, writeFile } from "node:fs/promises";

const version = process.env.VERSION;
const releaseDate = process.env.RELEASE_DATE;
const releaseCommits = (process.env.RELEASE_COMMITS ?? "").trim();
const path = "CHANGELOG.md";
const source = await readFile(path, "utf8");
const lines = source.replace(/\r\n/g, "\n").split("\n");
const unreleasedStart = lines.findIndex((line) => /^##\s+Unreleased\s*$/i.test(line.trim()));

if (!version || !releaseDate || unreleasedStart < 0) {
  throw new Error("CHANGELOG.md must contain an Unreleased section and release metadata must be set.");
}

if (lines.some((line) => new RegExp(`^##\\s+${version.replaceAll(".", "\\.")}(?:\\s|$)`).test(line))) {
  console.log(`CHANGELOG.md already contains ${version}; leaving it unchanged.`);
  process.exit(0);
}

let unreleasedEnd = lines.length;
for (let index = unreleasedStart + 1; index < lines.length; index += 1) {
  if (/^##\s+/.test(lines[index] ?? "")) {
    unreleasedEnd = index;
    break;
  }
}

const notes = lines.slice(unreleasedStart + 1, unreleasedEnd).join("\n").trim()
  || releaseCommits
  || "- Maintenance release.";
lines.splice(
  unreleasedStart,
  unreleasedEnd - unreleasedStart,
  "## Unreleased",
  "",
  `## ${version} - ${releaseDate}`,
  "",
  notes,
  ""
);

await writeFile(path, `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`);
