import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const bump = process.argv[2];
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(packageJson.version);

if (!match || !["patch", "minor", "major"].includes(bump)) {
  throw new Error("Usage: node scripts/next-release-version.mjs patch|minor|major");
}

let [, major, minor, patch] = match.map(Number);
if (bump === "major") {
  major += 1;
  minor = 0;
  patch = 0;
} else if (bump === "minor") {
  minor += 1;
  patch = 0;
} else {
  patch += 1;
}

process.stdout.write(`${major}.${minor}.${patch}`);
