import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import YAML from "yaml";

type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "date"
  | "datetime"
  | "select"
  | "multiSelect"
  | "user"
  | "userList"
  | "boolean"
  | "attachment"
  | "table"
  | "computed";

interface BlueprintField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string | number | boolean }>;
}

interface BlueprintForm {
  key: string;
  name: string;
  fields: BlueprintField[];
  groupTitle?: string;
}

interface BlueprintStep {
  id: string;
  name: string;
  type?: "step" | "subflow" | "gateway" | "end" | "fail";
  form?: string;
  assignee?: string;
  actions?: string[];
  subflowKey?: string;
}

interface BlueprintTransition {
  from: string;
  action: string;
  to: string;
}

interface Blueprint {
  flow: {
    key: string;
    name: string;
    createForm?: string;
    entry?: string;
    slaHours?: number;
  };
  forms: BlueprintForm[];
  steps: BlueprintStep[];
  transitions: BlueprintTransition[];
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-")
    .replace(/[\u4e00-\u9fa5]/g, (char) => `u${char.charCodeAt(0).toString(16)}`);
}

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let i = 2; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith("--")) {
      continue;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args.set(current, "true");
    } else {
      args.set(current, next);
      i += 1;
    }
  }
  return {
    input: args.get("--input"),
    outDir: args.get("--out-dir"),
    sample: args.get("--sample") === "true"
  };
}

function parseNaturalLanguage(source: string): Blueprint {
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const joined = lines.join("\n");
  const flowNameMatch = joined.match(/(?:流程名|流程名称|flow name)[:：]\s*(.+)/i);
  const flowKeyMatch = joined.match(/(?:流程key|flow key)[:：]\s*([a-z0-9-_]+)/i);
  const createFormMatch = joined.match(/(?:创建表单|立项表单|create form)[:：]\s*(.+)/i);

  const stepsLine = lines.find((line) => /^(步骤|环节|steps?)[:：]/i.test(line));
  if (!stepsLine) {
    throw new Error("Blueprint text must contain a '步骤:' or '环节:' line.");
  }
  const rawSteps = stepsLine.split(/[:：]/)[1]
    .split(/[、,，>→]/)
    .map((item) => item.trim())
    .filter(Boolean);

  const stepIds = rawSteps.map((name) => slugify(name));
  const createFormKey = createFormMatch ? slugify(createFormMatch[1]) : `${flowKeyMatch?.[1] ?? slugify(flowNameMatch?.[1] ?? "generated-flow")}-create-form`;

  const forms: BlueprintForm[] = [];
  if (createFormMatch) {
    forms.push({
      key: createFormKey,
      name: createFormMatch[1],
      groupTitle: "基础信息",
      fields: [
        { key: "title", label: "标题", type: "text", required: true },
        { key: "owner", label: "负责人", type: "user", required: true }
      ]
    });
  }

  for (const name of rawSteps) {
    const formLine = lines.find((line) => new RegExp(`^${name}\\s*(表单|form)[:：]`, "i").test(line));
    if (!formLine) {
      continue;
    }
    const fieldSpec = formLine.split(/[:：]/)[1].trim();
    const fields = fieldSpec.split(/[、,，]/).map((fieldLabel) => fieldLabel.trim()).filter(Boolean);
    forms.push({
      key: `${slugify(name)}-form`,
      name: `${name}表单`,
      groupTitle: name,
      fields: fields.map((label, index) => ({
        key: slugify(label || `field-${index + 1}`),
        label,
        type: /负责人|owner|处理人/i.test(label) ? "user" : "text",
        required: true
      }))
    });
  }

  const steps: BlueprintStep[] = rawSteps.map((name, index) => ({
    id: stepIds[index],
    name,
    type: index === rawSteps.length - 1 ? "end" : "step",
    form: forms.find((form) => form.key === `${slugify(name)}-form`)?.key,
    assignee: index === 0 ? "role:pm" : "field:owner",
    actions: index === rawSteps.length - 1 ? ["complete"] : ["approve", "reject"]
  }));

  const transitions: BlueprintTransition[] = [];
  for (let index = 0; index < stepIds.length - 1; index += 1) {
    const from = stepIds[index];
    const to = stepIds[index + 1];
    transitions.push({
      from,
      action: "approve",
      to
    });
  }

  return {
    flow: {
      key: flowKeyMatch?.[1] ?? slugify(flowNameMatch?.[1] ?? "generated-flow"),
      name: flowNameMatch?.[1] ?? "自动生成流程",
      createForm: forms.some((form) => form.key === createFormKey) ? createFormKey : undefined,
      entry: stepIds[0],
      slaHours: 72
    },
    forms,
    steps,
    transitions
  };
}

function toFormJson(form: BlueprintForm) {
  return {
    kind: "form-template",
    version: "v1",
    key: form.key,
    name: form.name,
    schema: {
      fields: form.fields.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        required: field.required ?? false,
        ...(field.defaultValue !== undefined ? { defaultValue: field.defaultValue } : {}),
        ...(field.options ? { options: field.options } : {})
      }))
    },
    layout: {
      groups: [
        {
          key: slugify(form.groupTitle ?? form.name),
          title: form.groupTitle ?? form.name,
          fields: form.fields.map((field) => field.key)
        }
      ]
    },
    behavior: {
      computed: [],
      draftable: true
    },
    metadata: {}
  };
}

function parseAssigneeRule(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  const [type, raw] = value.split(":");
  if (!raw) {
    return { type: "static", value };
  }
  if (type === "role" || type === "user" || type === "group" || type === "field") {
    return { type, value: raw };
  }
  return { type: "static", value };
}

function toFlowJson(blueprint: Blueprint) {
  return {
    kind: "flow-template",
    version: "v1",
    key: blueprint.flow.key,
    name: blueprint.flow.name,
    createForm: blueprint.flow.createForm,
    entry: blueprint.flow.entry,
    steps: blueprint.steps.map((step) => ({
      id: step.id,
      type: step.type ?? "step",
      name: step.name,
      ...(step.form ? { taskForm: step.form } : {}),
      ...(parseAssigneeRule(step.assignee) ? { assigneeRule: parseAssigneeRule(step.assignee) } : {}),
      actions: step.actions ?? ["complete"],
      ...(step.type === "subflow" && step.subflowKey ? { subflow: { flowKey: step.subflowKey } } : {})
    })),
    transitions: blueprint.transitions.map((transition) => ({
      from: transition.from,
      action: transition.action,
      to: transition.to
    })),
    policies: blueprint.flow.slaHours ? { slaHours: blueprint.flow.slaHours } : {},
    triggers: [],
    metadata: {
      source: "blueprint-generator"
    }
  };
}

async function ensureDir(path: string) {
  await mkdir(path, { recursive: true });
}

async function run() {
  const args = parseArgs(process.argv);
  if (args.sample) {
    process.stdout.write(`# blueprint.yaml
flow:
  key: project-delivery
  name: 项目推进流程
  createForm: project-intake-form
  entry: kickoff
  slaHours: 72
forms:
  - key: project-intake-form
    name: 项目立项表
    groupTitle: 基础信息
    fields:
      - key: projectName
        label: 项目名称
        type: text
        required: true
      - key: owner
        label: 项目负责人
        type: user
        required: true
  - key: kickoff-form
    name: 立项审批表
    groupTitle: 审批
    fields:
      - key: scopeConfirmed
        label: 范围已确认
        type: boolean
        required: true
steps:
  - id: kickoff
    name: 项目立项
    type: step
    form: kickoff-form
    assignee: role:pm
    actions: [approve, reject]
  - id: delivery
    name: 实施交付
    type: step
    assignee: field:owner
    actions: [complete, terminate]
  - id: done
    name: 完成
    type: end
    actions: [complete]
transitions:
  - from: kickoff
    action: approve
    to: delivery
  - from: kickoff
    action: reject
    to: kickoff
  - from: delivery
    action: complete
    to: done
`);
    return;
  }

  if (!args.input || !args.outDir) {
    throw new Error("Usage: pnpm gen:blueprint --input <spec-file> --out-dir <dir> [--sample]");
  }

  const inputPath = isAbsolute(args.input) ? args.input : resolve(process.cwd(), args.input);
  const outDir = isAbsolute(args.outDir) ? args.outDir : resolve(process.cwd(), args.outDir);
  const raw = await readFile(inputPath, "utf8");
  const parsed = inputPath.endsWith(".yaml") || inputPath.endsWith(".yml")
    ? YAML.parse(raw)
    : inputPath.endsWith(".json")
      ? JSON.parse(raw)
      : parseNaturalLanguage(raw);
  const blueprint = parsed as Blueprint;

  await ensureDir(outDir);
  await ensureDir(resolve(outDir, "forms"));
  await ensureDir(resolve(outDir, "flows"));

  const emittedForms: string[] = [];
  for (const form of blueprint.forms) {
    const formPath = resolve(outDir, "forms", `${form.key}.json`);
    await writeFile(formPath, `${JSON.stringify(toFormJson(form), null, 2)}\n`, "utf8");
    emittedForms.push(formPath);
  }

  const flowPath = resolve(outDir, "flows", `${blueprint.flow.key}.json`);
  await writeFile(flowPath, `${JSON.stringify(toFlowJson(blueprint), null, 2)}\n`, "utf8");

  const manifestPath = resolve(outDir, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify({
    blueprint: inputPath,
    flow: flowPath,
    forms: emittedForms
  }, null, 2)}\n`, "utf8");

  process.stdout.write(`${JSON.stringify({
    ok: true,
    blueprint: inputPath,
    outDir,
    flow: flowPath,
    forms: emittedForms,
    manifest: manifestPath
  }, null, 2)}\n`);
}

run().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : "Unknown error"
  }, null, 2)}\n`);
  process.exit(1);
});
