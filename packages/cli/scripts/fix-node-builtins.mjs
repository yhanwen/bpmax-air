import { readFile, writeFile } from "node:fs/promises";

const bundlePath = new URL("../dist/index.js", import.meta.url);
const source = await readFile(bundlePath, "utf8");
const fixed = source.replaceAll('from "sqlite"', 'from "node:sqlite"');

if (fixed !== source) {
  await writeFile(bundlePath, fixed, "utf8");
}
