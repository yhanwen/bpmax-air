# Skill Integration

## Installation Modes

See [skill-distribution.md](./skill-distribution.md) for release zip packaging, `cc-switch` usage, and multi-client installation paths.

### Repository mode

Use this while developing locally or before the CLI package is published:

```bash
pnpm install
pnpm dev:cli -- --db ./demo.db flow list --json
./docs/skills/bpair-skill/scripts/install.sh
```

### Published CLI mode

Use this after `@bpair/cli` is published to npm:

```bash
npx -y @bpair/cli --db ./demo.db flow list --json
```

The recommended default is published CLI mode. Repository mode is the fallback when working inside the monorepo.

Recommended orchestration pattern for agent skills:

1. Generate or patch `flow.json` and `form.json`
2. Call `npx -y @bpair/cli ... --json` or `pnpm dev:cli -- ... --json`
3. Read structured output
4. Summarize human-facing result separately

## High-Level Skill Actions

- `create_flow_from_prompt`
- `patch_flow`
- `create_form_from_fields`
- `create_project`
- `update_task_form`
- `submit_task_action`
- `create_task_instance`
- `batch_create_task_instances`
- `submit_task_instance_action`
- `get_project_snapshot`
- `explain_project_blockers`

## Action To CLI Mapping

- `create_flow_from_prompt`
  - Generate or update one flow JSON file
  - Call `npx -y @bpair/cli flow create --input <flow.json> --json`
- `patch_flow`
  - Generate one patch file
  - Call `npx -y @bpair/cli flow update --key <flow-key> --patch <patch.json> --json`
- `create_form_from_fields`
  - Generate one form JSON file
  - Call `npx -y @bpair/cli form create --input <form.json> --json`
- `create_project`
  - Generate one submission JSON file
  - Call `npx -y @bpair/cli project create --flow <flow-key> --name <project-name> --data <submission.json> --json`
- `update_task_form`
  - Generate one submission JSON file
  - Call `npx -y @bpair/cli task draft-save --task <task-id> --data <submission.json> --json`
- `submit_task_action`
  - Generate one submission JSON file if needed
  - Call `npx -y @bpair/cli task submit --task <task-id> --action <action> --data <submission.json> --json`
- `create_task_instance`
  - Generate one task instance payload JSON file
  - Call `npx -y @bpair/cli task-instance create --project <project-id> --input <task-instance.json> --json`
- `batch_create_task_instances`
  - Generate one JSON array payload file
  - Call `npx -y @bpair/cli task-instance batch-create --project <project-id> --input <task-instances.json> --json`
- `submit_task_instance_action`
  - Generate one payload JSON file if needed
  - Call `npx -y @bpair/cli task-instance submit --id <task-instance-id> --action <action> --data <payload.json> --json`
- `get_project_snapshot`
  - Call `npx -y @bpair/cli project get --id <project-id> --json`
  - Optionally call `npx -y @bpair/cli task list --project <project-id> --json`
  - Optionally call `npx -y @bpair/cli task-instance list --project <project-id> --json`
- `explain_project_blockers`
  - Call `npx -y @bpair/cli runtime explain --project <project-id> --json`
  - Optionally call `npx -y @bpair/cli audit tail --project <project-id> --json`

## Skill Response Pattern

Each skill action should return two layers:

1. Machine layer
   - Raw JSON command result
   - File paths used as input
   - Command executed
2. Human layer
   - One short summary paragraph
   - If relevant, one flat list of next actions

## Safe Defaults For Agents

- Always call CLI with `--json`
- Prefer `npx -y @bpair/cli` as the default launcher outside the repository
- Prefer file-based input over inline JSON flags
- Read existing template or project state before patching
- If a requested change can be expressed as a patch, prefer `update` over recreate
- After any state-changing task submission, fetch the updated project snapshot
- Distinguish flow-step `task` from project-level `task-instance` and choose the correct command surface
- For software project scenarios, prefer `task-instance` for daily execution work and reserve `task submit` for phase-gate actions
- Use `runtime explain` when the user asks why a project is blocked or stalled
- When the user asks what workflows or forms exist, query and return stored templates only, not skill action names

## Recommended Invocation Contract

When another agent or skill wraps `bpair`, prefer this internal contract:

```json
{
  "action": "submit_task_instance_action",
  "inputs": {
    "taskInstanceId": "ti_123",
    "action": "complete",
    "dataFile": "/abs/path/task-instance-submit.json"
  },
  "command": "npx -y @bpair/cli task-instance submit --id ti_123 --action complete --data /abs/path/task-instance-submit.json --json",
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

## Presentation Pattern

- Agent view: raw JSON result
- Human view: concise explanation
- Debug view: `runtime explain` + `audit tail`
