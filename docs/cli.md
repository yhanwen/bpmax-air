# CLI

## Core Commands

```bash
bpair form create --input ./form.json --json
bpair form update --key kickoff-form --patch ./patch.json --json
bpair flow create --input ./flow.json --json
bpair flow publish --key project-delivery --json
bpair project create --flow project-delivery --name "项目A" --data ./project.json --json
bpair task list --project p_xxx --json
bpair task submit --task t_xxx --action approve --data ./submit.json --json
bpair runtime explain --project p_xxx --json
bpair audit tail --project p_xxx --json
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
