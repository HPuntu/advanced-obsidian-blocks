import { readFile, writeFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const versions = JSON.parse(await readFile("versions.json", "utf8"));
const version = packageJson.version;

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`Plugin versions must use x.y.z format. Received: ${version}`);
}

manifest.version = version;
versions[version] = manifest.minAppVersion;

await writeFile("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile("versions.json", `${JSON.stringify(versions, null, 2)}\n`);

console.log(`Synced plugin metadata to ${version}.`);
