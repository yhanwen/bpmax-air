# CLI

## Core Commands

```bash
npx -y @bpair/cli form create --input ./form.json --json
npx -y @bpair/cli form update --key kickoff-form --patch ./patch.json --json
npx -y @bpair/cli flow create --input ./flow.json --json
npx -y @bpair/cli flow publish --key project-delivery --json
npx -y @bpair/cli project create --flow project-delivery --name "项目A" --data ./project.json --json
npx -y @bpair/cli task list --project p_xxx --json
npx -y @bpair/cli task submit --task t_xxx --action approve --data ./submit.json --json
npx -y @bpair/cli task-instance create --project p_xxx --input ./task-instance.json --json
npx -y @bpair/cli task-instance batch-create --project p_xxx --input ./task-instances.json --json
npx -y @bpair/cli task-instance list --project p_xxx --json
npx -y @bpair/cli task-instance get --id ti_xxx --json
npx -y @bpair/cli task-instance submit --id ti_xxx --action complete --data ./task-instance-submit.json --json
npx -y @bpair/cli runtime explain --project p_xxx --json
npx -y @bpair/cli audit tail --project p_xxx --json
```

## Runtime Model

- `task` commands operate the current flow step work item
- `task-instance` commands operate project-scoped parallel tasks
- `runtime explain` now returns both pending step tasks and project-level task-instance summaries

Typical software project pattern:

1. Use `project create` to launch the project main flow.
2. Use `task submit` to pass stage reviews or other flow steps.
3. Use `task-instance create` or `task-instance batch-create` for execution work inside the project.
4. Use `task-instance submit` to move parallel tasks through `pending`, `in_progress`, `waiting_review`, `completed`, `blocked`, or `cancelled`.

## Output Contract

All commands return:

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "requestId": "req_xxx",
    "revision": 1
  },
  "errors": []
}
```
