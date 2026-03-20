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
npx -y @bpair/cli runtime explain --project p_xxx --json
npx -y @bpair/cli audit tail --project p_xxx --json
```

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
