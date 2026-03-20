import { copyFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

const rootDir = process.cwd();
const artifactsDir = join(rootDir, ".artifacts");
const releaseDir = join(artifactsDir, "releases");

async function main(): Promise<void> {
  await mkdir(releaseDir, { recursive: true });
  const files = await readdir(artifactsDir);

  for (const file of files) {
    if (!file.endsWith(".tgz")) {
      continue;
    }
    await copyFile(join(artifactsDir, file), join(releaseDir, file));
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
