#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { Command } from "commander";
import YAML from "yaml";
import { BpairEngine } from "@bpair/core";
import { BpairError, fail, ok } from "@bpair/shared";
import { SqliteBpairRepository } from "@bpair/storage-sqlite";

function loadEngine(dbPath?: string): BpairEngine {
  return new BpairEngine({
    repository: new SqliteBpairRepository({ databasePath: dbPath })
  });
}

async function parseInputFile(path: string): Promise<unknown> {
  const raw = await readFile(path, "utf8");
  const ext = extname(path).toLowerCase();
  return ext === ".yaml" || ext === ".yml" ? YAML.parse(raw) : JSON.parse(raw);
}

async function parseSubmission(path?: string): Promise<unknown> {
  if (!path) {
    return undefined;
  }
  const parsed = await parseInputFile(path);
  if (parsed && typeof parsed === "object" && "data" in (parsed as Record<string, unknown>)) {
    return parsed;
  }
  return { data: parsed };
}

function outputSuccess(data: unknown, meta: { revision?: number | null } = {}): never {
  process.stdout.write(`${JSON.stringify(ok(data, meta), null, 2)}\n`);
  process.exit(0);
}

function outputError(error: unknown): never {
  const payload = error instanceof BpairError
    ? fail(error.code, error.message)
    : fail("INTERNAL_ERROR", error instanceof Error ? error.message : "Unknown error");
  process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(1);
}

function withEngine<T>(runner: (engine: BpairEngine, options: Record<string, unknown>, root: Record<string, unknown>) => Promise<T> | T) {
  return async (options: Record<string, unknown>, command: Command) => {
    try {
      const root = command.optsWithGlobals();
      const engine = loadEngine(root.db as string | undefined);
      const result = await runner(engine, options, root);
      const revision = typeof result === "object" && result && "revision" in (result as Record<string, unknown>)
        ? Number((result as Record<string, unknown>).revision)
        : null;
      outputSuccess(result, { revision });
    } catch (error) {
      outputError(error);
    }
  };
}

const program = new Command();
program
  .name("bpair")
  .description("AI-first headless BPM engine CLI")
  .option("--db <path>", "SQLite database path", "bpair.db");

const form = program.command("form");
form.command("create")
  .requiredOption("--input <path>")
  .option("--json", "JSON output", true)
  .action(withEngine(async (engine, options) => engine.createForm(await parseInputFile(String(options.input)))));

form.command("update")
  .requiredOption("--key <key>")
  .requiredOption("--patch <path>")
  .option("--json", "JSON output", true)
  .action(withEngine(async (engine, options) => engine.updateForm(String(options.key), await parseInputFile(String(options.patch)))));

form.command("get")
  .requiredOption("--key <key>")
  .option("--revision <revision>")
  .option("--json", "JSON output", true)
  .action(withEngine((engine, options) => engine.getForm(String(options.key), options.revision ? Number(options.revision) : undefined)));

form.command("list")
  .option("--json", "JSON output", true)
  .action(withEngine((engine) => engine.listForms()));

form.command("diff")
  .requiredOption("--key <key>")
  .requiredOption("--from <revision>")
  .requiredOption("--to <revision>")
  .option("--json", "JSON output", true)
  .action(withEngine((engine, options) => engine.diffForm(String(options.key), Number(options.from), Number(options.to))));

const flow = program.command("flow");
flow.command("create")
  .requiredOption("--input <path>")
  .option("--json", "JSON output", true)
  .action(withEngine(async (engine, options) => engine.createFlow(await parseInputFile(String(options.input)))));

flow.command("update")
  .requiredOption("--key <key>")
  .requiredOption("--patch <path>")
  .option("--json", "JSON output", true)
  .action(withEngine(async (engine, options) => engine.updateFlow(String(options.key), await parseInputFile(String(options.patch)))));

flow.command("get")
  .requiredOption("--key <key>")
  .option("--revision <revision>")
  .option("--json", "JSON output", true)
  .action(withEngine((engine, options) => engine.getFlow(String(options.key), options.revision ? Number(options.revision) : undefined)));

flow.command("list")
  .option("--json", "JSON output", true)
  .action(withEngine((engine) => engine.listFlows()));

flow.command("publish")
  .requiredOption("--key <key>")
  .option("--revision <revision>")
  .option("--json", "JSON output", true)
  .action(withEngine((engine, options) => engine.publishFlow(String(options.key), options.revision ? Number(options.revision) : undefined)));

flow.command("validate")
  .requiredOption("--input <path>")
  .option("--json", "JSON output", true)
  .action(withEngine(async (engine, options) => engine.validateFlow(await parseInputFile(String(options.input)))));

flow.command("simulate")
  .requiredOption("--key <key>")
  .requiredOption("--input <path>")
  .option("--json", "JSON output", true)
  .action(withEngine(async (engine, options) => engine.simulateFlow(String(options.key), await parseInputFile(String(options.input)) as Array<{ stepId: string; action: "approve" | "reject" | "complete" | "route" | "auto" | "cancel" | "terminate" | "withdraw" }>)));

const project = program.command("project");
project.command("create")
  .requiredOption("--flow <key>")
  .requiredOption("--name <name>")
  .option("--data <path>")
  .option("--json", "JSON output", true)
  .action(withEngine(async (engine, options) => engine.createProject({
    name: String(options.name),
    flowKey: String(options.flow),
    createSubmission: await parseSubmission(options.data ? String(options.data) : undefined)
  })));

project.command("list")
  .option("--json", "JSON output", true)
  .action(withEngine((engine) => engine.listProjects()));

project.command("get")
  .requiredOption("--id <id>")
  .option("--json", "JSON output", true)
  .action(withEngine((engine, options) => engine.getProject(String(options.id))));

project.command("data")
  .requiredOption("--id <id>")
  .option("--json", "JSON output", true)
  .action(withEngine((engine, options) => engine.getProjectData(String(options.id))));

const task = program.command("task");
task.command("list")
  .option("--project <id>")
  .option("--json", "JSON output", true)
  .action(withEngine((engine, options) => engine.listTasks(options.project ? String(options.project) : undefined)));

task.command("get")
  .requiredOption("--id <id>")
  .option("--json", "JSON output", true)
  .action(withEngine((engine, options) => engine.getTask(String(options.id))));

task.command("draft-save")
  .requiredOption("--task <id>")
  .requiredOption("--data <path>")
  .option("--json", "JSON output", true)
  .action(withEngine(async (engine, options) => engine.saveTaskDraft(String(options.task), await parseSubmission(String(options.data)))));

task.command("submit")
  .requiredOption("--task <id>")
  .requiredOption("--action <action>")
  .option("--actor <actor>", "Actor id", "system")
  .option("--data <path>")
  .option("--json", "JSON output", true)
  .action(withEngine(async (engine, options) => engine.submitTask({
    taskId: String(options.task),
    action: String(options.action) as "approve" | "reject" | "complete" | "route" | "auto" | "cancel" | "terminate" | "withdraw",
    actorId: String(options.actor),
    submission: await parseSubmission(options.data ? String(options.data) : undefined)
  })));

task.command("reassign")
  .requiredOption("--task <id>")
  .requiredOption("--assignees <values>")
  .option("--json", "JSON output", true)
  .action(withEngine((engine, options) => engine.reassignTask(String(options.task), String(options.assignees).split(",").map((value) => value.trim()).filter(Boolean))));

const runtime = program.command("runtime");
runtime.command("explain")
  .requiredOption("--project <id>")
  .option("--json", "JSON output", true)
  .action(withEngine((engine, options) => engine.explainRuntime(String(options.project))));

const audit = program.command("audit");
audit.command("tail")
  .option("--project <id>")
  .option("--limit <count>", "Event count", "20")
  .option("--json", "JSON output", true)
  .action(withEngine((engine, options) => engine.auditTail(Number(options.limit), options.project ? String(options.project) : undefined)));

const argv = process.argv[2] === "--"
  ? [process.argv[0], process.argv[1], ...process.argv.slice(3)]
  : process.argv;

program.parseAsync(argv).catch(outputError);
