# Skill Integration

Recommended orchestration pattern for agent skills:

1. Generate or patch `flow.json` and `form.json`
2. Call `bpair ... --json`
3. Read structured output
4. Summarize human-facing result separately

## High-Level Skill Actions

- `create_flow_from_prompt`
- `patch_flow`
- `create_form_from_fields`
- `create_project`
- `update_task_form`
- `submit_task_action`
- `get_project_snapshot`
- `explain_project_blockers`

## Action To CLI Mapping

- `create_flow_from_prompt`
  - Generate or update one flow JSON file
  - Call `bpair flow create --input <flow.json> --json`
- `patch_flow`
  - Generate one patch file
  - Call `bpair flow update --key <flow-key> --patch <patch.json> --json`
- `create_form_from_fields`
  - Generate one form JSON file
  - Call `bpair form create --input <form.json> --json`
- `create_project`
  - Generate one submission JSON file
  - Call `bpair project create --flow <flow-key> --name <project-name> --data <submission.json> --json`
- `update_task_form`
  - Generate one submission JSON file
  - Call `bpair task draft-save --task <task-id> --data <submission.json> --json`
- `submit_task_action`
  - Generate one submission JSON file if needed
  - Call `bpair task submit --task <task-id> --action <action> --data <submission.json> --json`
- `get_project_snapshot`
  - Call `bpair project get --id <project-id> --json`
  - Optionally call `bpair task list --project <project-id> --json`
- `explain_project_blockers`
  - Call `bpair runtime explain --project <project-id> --json`
  - Optionally call `bpair audit tail --project <project-id> --json`

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
- Prefer file-based input over inline JSON flags
- Read existing template or project state before patching
- If a requested change can be expressed as a patch, prefer `update` over recreate
- After any state-changing task submission, fetch the updated project snapshot
- Use `runtime explain` when the user asks why a project is blocked or stalled
- When the user asks what workflows or forms exist, query and return stored templates only, not skill action names

## Recommended Invocation Contract

When another agent or skill wraps `bpair`, prefer this internal contract:

```json
{
  "action": "submit_task_action",
  "inputs": {
    "taskId": "t_123",
    "action": "approve",
    "dataFile": "/abs/path/submit.json"
  },
  "command": "bpair task submit --task t_123 --action approve --data /abs/path/submit.json --json",
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
