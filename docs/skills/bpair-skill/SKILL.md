---
name: bpair-skill
description: Use this skill whenever the user wants to create, update, inspect, validate, simulate, or operate BPMax-Air workflows, forms, projects, tasks, or audit trails. Also use it when the user describes BPM or form changes in natural language and the work should be translated into BPMax-Air JSON templates plus `bpair` CLI commands.
---

# BPMax-Air Skill

Use this skill to operate the BPMax-Air engine through its CLI in a way that is stable for both humans and agents.

## Command launcher

Prefer the published CLI:

```bash
npx -y @bpair/cli ...
```

If the repository is already cloned locally and the caller intends to use the workspace version, fall back to:

```bash
pnpm dev:cli -- ...
```

Treat both launchers as the same command surface. The subcommands and JSON contracts must stay identical.

## What this skill does

- Turn natural-language BPM requests into BPMax-Air JSON artifacts
- Turn a compact blueprint into final flow/form JSON files
- Execute `bpair` commands with `--json`
- Patch existing flows and forms instead of recreating them when possible
- Explain project state, blockers, task routing, and recent audit events

## When to use it

Use this skill whenever the user asks to:

- create or modify a flow template
- create or modify a form template
- launch a project instance
- fill, save, or submit a task form
- inspect project details or current workflow state
- explain why a workflow is blocked
- list audit history or recent task activity

## Query semantics

When the user asks questions like:

- `有什么流程`
- `当前有哪些流程模板`
- `列出流程`
- `有哪些表单`

return only actual engine data:

- stored flow templates
- stored form templates
- project instances
- task records

Do not answer with skill capabilities, action recipes, or usage flows such as:

- `Create flow from prompt`
- `Patch an existing flow`
- `Submit task action`

For process-list questions, prefer:

```bash
npx -y @bpair/cli flow list --json
```

For form-list questions, prefer:

```bash
npx -y @bpair/cli form list --json
```

## Working rules

1. Prefer the published CLI via `npx -y @bpair/cli` over direct SDK or HTTP calls unless the task explicitly asks for code integration.
2. Always pass `--json`.
3. For large inputs, write JSON files and pass them with `--input`, `--patch`, or `--data`.
4. If the user is already inside the repository and wants the local workspace version, use `pnpm dev:cli -- ...` instead of `npx`.
5. For workflow generation tasks, prefer this two-stage path:
   - first write `blueprint.yaml`
   - then compile it with `pnpm gen:blueprint --input <blueprint> --out-dir <dir>`
6. If the request is very free-form, first normalize it into the blueprint format before generating JSON.
7. Read current state before patching:
   - use `bpair flow get`
   - use `bpair form get`
   - use `bpair project get`
   - use `bpair task get`
8. After any write action, return both:
   - the raw JSON result
   - a short user-facing explanation

## Blueprint generator

The local generator lives at:

`/Users/yanghanwen/Development/Cicada/bpmax-air/tools/generate-blueprint.ts`

It accepts:

- structured `yaml`
- structured `json`
- lightweight natural-language text with lines like:
  - `流程名: 项目推进流程`
  - `流程key: project-delivery`
  - `步骤: 立项、开发、验收`
  - `创建表单: 项目立项表`
  - `立项表单: 项目名称, 项目负责人`
  - `验收表单: 验收结论, 验收附件`

Prefer explicit keys in blueprint mode:

- `flow.key`
- `forms[].key`
- `steps[].id`

If the input only contains Chinese names and no explicit keys, the generator falls back to stable machine ids. They are valid, but less readable, so use explicit keys whenever the workflow will be maintained over time.

It emits:

- `flows/<flow-key>.json`
- `forms/<form-key>.json`
- `manifest.json`

### Generate from blueprint

```bash
pnpm gen:blueprint --input /abs/path/blueprint.yaml --out-dir /abs/path/generated
```

### Print sample blueprint

```bash
pnpm gen:blueprint --sample
```

## Action recipes

### Create flow from prompt

1. Convert the request into `blueprint.yaml`.
2. Compile the blueprint into final JSON:

```bash
pnpm gen:blueprint --input /abs/path/blueprint.yaml --out-dir /abs/path/generated
```

3. If referenced forms do not exist yet, create them first.
4. Run:

```bash
npx -y @bpair/cli form create --input /abs/path/generated/forms/<form>.json --json
npx -y @bpair/cli flow create --input /abs/path/generated/flows/<flow>.json --json
```

5. If the user wants the flow usable immediately, also run:

```bash
npx -y @bpair/cli flow publish --key <flow-key> --json
```

### Patch an existing flow

1. Read the current flow.
2. Write a minimal patch file that only changes the requested parts.
3. Run:

```bash
npx -y @bpair/cli flow update --key <flow-key> --patch /abs/path/patch.json --json
```

### Create form from fields

1. Map requested fields into the BPMax-Air form schema.
2. Put validation in `schema`.
3. Put grouping in `layout`.
4. Put derived fields or draftability in `behavior`.
5. Run:

```bash
npx -y @bpair/cli form create --input /abs/path/form.json --json
```

### Create project

1. Make sure the target flow exists and is published if the workflow should be stable.
2. Write a create submission file with `data`.
3. Run:

```bash
npx -y @bpair/cli project create --flow <flow-key> --name "<project-name>" --data /abs/path/project.json --json
```

### Update task form draft

1. Read the task if field expectations are unclear.
2. Write a submission file with `data`.
3. Run:

```bash
npx -y @bpair/cli task draft-save --task <task-id> --data /abs/path/draft.json --json
```

### Submit task action

1. Confirm the target action from the flow or task context if needed.
2. Write a submission file when the step has a form.
3. Run:

```bash
npx -y @bpair/cli task submit --task <task-id> --action <action> --data /abs/path/submit.json --json
```

4. Immediately fetch the updated project state:

```bash
npx -y @bpair/cli project get --id <project-id> --json
```

### Explain blockers

Run:

```bash
npx -y @bpair/cli runtime explain --project <project-id> --json
npx -y @bpair/cli audit tail --project <project-id> --json
```

Then explain:

- current step
- pending task owners
- last transition or last missing action
- whether the project is waiting on a subflow, approval, or data completion

## Output format

Always produce:

### Machine result

```json
{
  "command": "npx -y @bpair/cli ... --json",
  "input_files": ["/abs/path/file.json"],
  "result": {
    "ok": true,
    "data": {},
    "meta": {
      "requestId": "req_xxx",
      "revision": null
    },
    "errors": []
  }
}
```

### Human summary

- Keep it short.
- Mention the object changed or inspected.
- Mention the next state if the workflow advanced.

## References

- Read `references/command-recipes.md` for concrete intent-to-command mappings.
- Read `references/prompt-templates.md` for reusable prompt skeletons.
- Read `references/blueprint-template.yaml` for the preferred generator input shape.
