import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const outputDirectory = "dist";
const outputPath = path.join(outputDirectory, `advanced-blocks-${manifest.version}.zip`);
const assets = ["main.js", "manifest.json", "styles.css"];

for (const asset of assets) {
  if (!existsSync(asset)) {
    throw new Error(`Missing release asset: ${asset}`);
  }
}

mkdirSync(outputDirectory, { recursive: true });
if (existsSync(outputPath)) {
  rmSync(outputPath);
}

const result = spawnSync("zip", ["-j", outputPath, ...assets], { stdio: "inherit" });
if (result.error) {
  throw result.error;
}
if (result.status !== 0) {
  throw new Error(`zip failed with exit code ${result.status}`);
}

console.log(`Packaged ${outputPath}.`);
