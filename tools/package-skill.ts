import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { strToU8, zipSync } from "fflate";

type PackageJson = {
  version: string;
  homepage?: string;
  repository?: {
    url?: string;
  };
};

const rootDir = process.cwd();
const skillName = "bpair-skill";
const skillDir = join(rootDir, "docs", "skills", skillName);
const outDir = join(rootDir, ".artifacts", "releases");

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return walk(fullPath);
    }
    return [fullPath];
  }));
  return files.flat();
}

function normalizeRepositoryUrl(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }
  return url.endsWith(".git") ? url.slice(0, -4) : url;
}

async function main(): Promise<void> {
  const packageJson = JSON.parse(await readFile(join(rootDir, "package.json"), "utf8")) as PackageJson;
  const version = packageJson.version;
  const repositoryUrl = normalizeRepositoryUrl(packageJson.repository?.url) ?? packageJson.homepage;

  await stat(skillDir);
  await mkdir(outDir, { recursive: true });

  const files = await walk(skillDir);
  const archiveEntries: Record<string, Uint8Array> = {};

  for (const filePath of files) {
    const content = await readFile(filePath);
    archiveEntries[`${skillName}/${relative(skillDir, filePath)}`] = content;
  }

  archiveEntries[`${skillName}/skill-package.json`] = strToU8(JSON.stringify({
    name: skillName,
    version,
    packageFormat: "skill-zip/v1",
    entry: "SKILL.md",
    recommendedInstaller: "cc-switch",
    compatibleClients: [
      "codex",
      "claude-code",
      "openclaw",
      "opencode"
    ],
    repositoryUrl
  }, null, 2));

  const archiveName = `${skillName}-v${version}.zip`;
  const archivePath = join(outDir, archiveName);
  const zip = zipSync(archiveEntries, { level: 9 });
  await writeFile(archivePath, zip);

  process.stdout.write(`${archivePath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
